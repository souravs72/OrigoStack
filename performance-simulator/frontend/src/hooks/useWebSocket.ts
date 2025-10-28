import { useEffect, useRef, useCallback } from "react";
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
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const isConnectedRef = useRef(false);

  const connect = useCallback((): void => {
    try {
      // Clean up existing connection
      if (socketRef.current) {
        socketRef.current.close();
      }

      // Convert HTTP URL to WebSocket URL and add /ws endpoint if not already present
      let wsUrl = url.replace(/^http/, "ws").replace(/\/$/, "");
      if (!wsUrl.endsWith("/ws")) {
        wsUrl += "/ws";
      }

      console.log("Connecting to WebSocket:", wsUrl);

      // Create new WebSocket connection
      socketRef.current = new WebSocket(wsUrl);

      const socket = socketRef.current;

      // Connection event handlers
      socket.onopen = () => {
        console.log("WebSocket connected successfully");
        reconnectAttempts.current = 0;
        isConnectedRef.current = true;
        simulatorActions.setConnectionStatus("connected");
        toast.success("Connected to Performance Simulator");
      };

      socket.onclose = (event) => {
        console.log("WebSocket disconnected:", event.code, event.reason);
        isConnectedRef.current = false;
        simulatorActions.setConnectionStatus("disconnected");

        if (!event.wasClean) {
          // Unexpected disconnect, try to reconnect
          attemptReconnect();
        }
      };

      socket.onerror = (error) => {
        console.error("WebSocket connection error:", error);
        isConnectedRef.current = false;
        simulatorActions.setConnectionStatus("error");
        attemptReconnect();
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          // Handle different message types based on the backend WebSocket implementation
          switch (message.type) {
            case "simulation_started":
              console.log("Simulation started:", message.data);
              if (isSimulationData(message.data)) {
                simulatorActions.addActiveSimulation(message.data as any);
                toast.success(
                  `Simulation "${message.data.config?.name || "Unknown"}" started`
                );
              }
              break;

            case "simulation_update":
              if (isSimulationUpdateData(message.data)) {
                simulatorActions.updateSimulationMetrics(
                  message.data.simulation_id,
                  message.data.metrics as any
                );
              }
              break;

            case "simulation_completed":
              console.log("Simulation completed:", message.data);
              if (isSimulationCompletedData(message.data)) {
                simulatorActions.completeSimulation(
                  message.data.simulation_id,
                  message.data.results
                );
                toast.success(
                  `Simulation "${message.data.results?.name || "Unknown"}" completed`
                );
              }
              break;

            case "metrics_update":
              if (isMetricsData(message.data)) {
                simulatorActions.updateRealTimeMetrics(message.data as any);
              }
              break;

            case "error":
              console.error("Simulator error:", message.data);
              if (isErrorData(message.data)) {
                toast.error(`Error: ${message.data.message}`);
              }
              break;

            case "connection_established":
              console.log("Connection established:", message.data);
              if (isConnectionData(message.data)) {
                simulatorActions.setClientId(message.data.client_id);
              }
              break;

            case "pong":
              // Handle ping response
              console.log("Received pong from server");
              break;

            default:
              console.log("Unknown message type:", message.type, message.data);
          }
        } catch (error) {
          console.error(
            "Failed to parse WebSocket message:",
            error,
            event.data
          );
        }
      };
    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
      isConnectedRef.current = false;
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
      socketRef.current.close();
      socketRef.current = null;
    }

    isConnectedRef.current = false;
    simulatorActions.setConnectionStatus("disconnected");
  }, []);

  const sendMessage = useCallback((type: string, data: unknown): void => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      const message = JSON.stringify({ type, data });
      socketRef.current.send(message);
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
      if (
        socketRef.current &&
        socketRef.current.readyState === WebSocket.OPEN
      ) {
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
    isConnected: isConnectedRef.current,
    sendMessage,
    subscribeToSimulation,
    unsubscribeFromSimulation,
    ping,
    getStatus,
  };
};
