import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import toast from "react-hot-toast";
import { simulatorActions } from "../stores/simulatorStore";

// Type guards for incoming data validation
const isSimulationData = (
  data: unknown
): data is { config?: { name?: string } } => {
  return typeof data === "object" && data !== null;
};

const isSimulationUpdateData = (
  data: unknown
): data is { simulation_id: number; metrics: unknown } => {
  return (
    typeof data === "object" &&
    data !== null &&
    typeof (data as { simulation_id?: unknown }).simulation_id === "number"
  );
};

const isSimulationCompletedData = (
  data: unknown
): data is { simulation_id: number; results: { name?: string } } => {
  return (
    typeof data === "object" &&
    data !== null &&
    typeof (data as { simulation_id?: unknown }).simulation_id === "number"
  );
};

const isMetricsData = (data: unknown): data is unknown => {
  return typeof data === "object" && data !== null;
};

const isErrorData = (data: unknown): data is { message: string } => {
  return (
    typeof data === "object" &&
    data !== null &&
    typeof (data as { message?: unknown }).message === "string"
  );
};

const isConnectionData = (data: unknown): data is { client_id: string } => {
  return (
    typeof data === "object" &&
    data !== null &&
    typeof (data as { client_id?: unknown }).client_id === "string"
  );
};

export const useWebSocket = (
  url: string
): {
  isConnected: boolean;
  sendMessage: (type: string, data: unknown) => void;
  subscribeToSimulation: (simulationId: number) => void;
  unsubscribeFromSimulation: (simulationId: number) => void;
  ping: () => void;
  getStatus: () => void;
} => {
  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback((): void => {
    try {
      // Clean up existing connection
      if (socketRef.current) {
        socketRef.current.disconnect();
      }

      // Create new WebSocket connection
      socketRef.current = io(url, {
        transports: ["websocket"],
        timeout: 20000,
        forceNew: true,
      });

      const socket = socketRef.current;

      // Connection event handlers
      socket.on("connect", () => {
        console.log("WebSocket connected successfully");
        reconnectAttempts.current = 0;
        simulatorActions.setConnectionStatus("connected");
        toast.success("Connected to Performance Simulator");
      });

      socket.on("disconnect", (reason) => {
        console.log("WebSocket disconnected:", reason);
        simulatorActions.setConnectionStatus("disconnected");

        if (reason === "io server disconnect") {
          // Server initiated disconnect, try to reconnect
          attemptReconnect();
        }
      });

      socket.on("connect_error", (error) => {
        console.error("WebSocket connection error:", error);
        simulatorActions.setConnectionStatus("error");
        attemptReconnect();
      });

      // Message handlers
      socket.on("simulation_started", (data: unknown) => {
        console.log("Simulation started:", data);
        if (isSimulationData(data)) {
          simulatorActions.addActiveSimulation(data as any);
          toast.success(
            `Simulation "${data.config?.name || "Unknown"}" started`
          );
        }
      });

      socket.on("simulation_update", (data: unknown) => {
        if (isSimulationUpdateData(data)) {
          simulatorActions.updateSimulationMetrics(
            data.simulation_id,
            data.metrics as any
          );
        }
      });

      socket.on("simulation_completed", (data: unknown) => {
        console.log("Simulation completed:", data);
        if (isSimulationCompletedData(data)) {
          simulatorActions.completeSimulation(data.simulation_id, data.results);
          toast.success(
            `Simulation "${data.results?.name || "Unknown"}" completed`
          );
        }
      });

      socket.on("metrics_update", (data: unknown) => {
        if (isMetricsData(data)) {
          simulatorActions.updateRealTimeMetrics(data as any);
        }
      });

      socket.on("error", (data: unknown) => {
        console.error("Simulator error:", data);
        if (isErrorData(data)) {
          toast.error(`Error: ${data.message}`);
        }
      });

      socket.on("connection_established", (data: unknown) => {
        console.log("Connection established:", data);
        if (isConnectionData(data)) {
          simulatorActions.setClientId(data.client_id);
        }
      });
    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
      simulatorActions.setConnectionStatus("error");
      attemptReconnect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const attemptReconnect = useCallback((): void => {
    if (reconnectAttempts.current >= maxReconnectAttempts) {
      console.error("Max reconnection attempts reached");
      toast.error("Unable to connect to simulator. Please refresh the page.");
      return;
    }

    const delay = Math.min(
      1000 * Math.pow(2, reconnectAttempts.current),
      30000
    );
    reconnectAttempts.current++;

    console.log(
      `Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts.current})`
    );

    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, delay);
  }, [connect]);

  const disconnect = useCallback((): void => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    simulatorActions.setConnectionStatus("disconnected");
  }, []);

  const sendMessage = useCallback((type: string, data: unknown): void => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit(type, data);
    } else {
      console.warn("WebSocket not connected, message not sent:", {
        type,
        data,
      });
      toast.error("Connection lost. Please refresh the page.");
    }
  }, []);

  // WebSocket API methods
  const subscribeToSimulation = useCallback(
    (simulationId: number): void => {
      sendMessage("subscribe_simulation", { simulation_id: simulationId });
    },
    [sendMessage]
  );

  const unsubscribeFromSimulation = useCallback(
    (simulationId: number): void => {
      sendMessage("unsubscribe_simulation", { simulation_id: simulationId });
    },
    [sendMessage]
  );

  const ping = useCallback((): void => {
    sendMessage("ping", { timestamp: Date.now() });
  }, [sendMessage]);

  const getStatus = useCallback((): void => {
    sendMessage("get_status", {});
  }, [sendMessage]);

  // Initialize connection on mount
  useEffect(() => {
    connect();

    // Set up ping interval to keep connection alive
    const pingInterval = setInterval(() => {
      if (socketRef.current && socketRef.current.connected) {
        ping();
      }
    }, 30000); // Ping every 30 seconds

    return () => {
      clearInterval(pingInterval);
      disconnect();
    };
  }, [connect, disconnect, ping]);

  // Expose WebSocket API
  useEffect(() => {
    simulatorActions.setWebSocketAPI({
      subscribeToSimulation,
      unsubscribeFromSimulation,
      ping,
      getStatus,
      sendMessage,
    });
  }, [
    subscribeToSimulation,
    unsubscribeFromSimulation,
    ping,
    getStatus,
    sendMessage,
  ]);

  return {
    isConnected: socketRef.current?.connected || false,
    sendMessage,
    subscribeToSimulation,
    unsubscribeFromSimulation,
    ping,
    getStatus,
  };
};
