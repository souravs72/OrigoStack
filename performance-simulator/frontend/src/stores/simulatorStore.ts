import { create } from "zustand";

interface SimulationStatus {
  id: number;
  name: string;
  status: "starting" | "running" | "completed" | "failed";
  startTime: Date;
  endTime?: Date;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  currentRPS: number;
  avgResponseTime: number;
  maxRPS: number;
  config?: any;
}

interface RealtimeMetrics {
  timestamp: number;
  rps: number;
  responseTime: number;
  errorRate: number;
  activeConnections: number;
  throughputHistory: number[];
  responseTimeHistory: number[];
  errorRateHistory: number[];
}

interface WebSocketAPI {
  subscribeToSimulation: (simulationId: number) => void;
  unsubscribeFromSimulation: (simulationId: number) => void;
  ping: () => void;
  getStatus: () => void;
  sendMessage: (type: string, data: any) => void;
}

interface SimulatorStoreState {
  // Connection state
  connectionStatus: "disconnected" | "connecting" | "connected" | "error";
  clientId: string | null;
  webSocketAPI: WebSocketAPI | null;

  // Simulation state
  activeSimulations: SimulationStatus[];
  realtimeMetrics: RealtimeMetrics | null;
  selectedSimulation: SimulationStatus | null;

  // Historical data
  simulationHistory: SimulationStatus[];
  performanceReports: any[];

  // UI state
  isLoading: boolean;
  error: string | null;
}

interface SimulatorStoreActions {
  // Actions
  setConnectionStatus: (
    status: "disconnected" | "connecting" | "connected" | "error"
  ) => void;
  setClientId: (clientId: string) => void;
  setWebSocketAPI: (api: WebSocketAPI) => void;

  addActiveSimulation: (simulation: SimulationStatus) => void;
  updateSimulationMetrics: (
    simulationId: number,
    metrics: Partial<SimulationStatus>
  ) => void;
  completeSimulation: (simulationId: number, results: any) => void;
  removeSimulation: (simulationId: number) => void;

  updateRealTimeMetrics: (metrics: RealtimeMetrics) => void;
  setSelectedSimulation: (simulation: SimulationStatus | null) => void;

  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Computed values
  getActiveSimulationsCount: () => number;
  getRunningSimulationsCount: () => number;
  getTotalRequests: () => number;
  getAverageRPS: () => number;
  getOverallSuccessRate: () => number;
}

type SimulatorStore = SimulatorStoreState & SimulatorStoreActions;

export const useSimulatorStore = create<SimulatorStore>((set, get) => ({
  // Initial state
  connectionStatus: "disconnected",
  clientId: null,
  webSocketAPI: null,
  activeSimulations: [],
  realtimeMetrics: null,
  selectedSimulation: null,
  simulationHistory: [],
  performanceReports: [],
  isLoading: false,
  error: null,

  // Connection actions
  setConnectionStatus: (status) => set({ connectionStatus: status }),

  setClientId: (clientId) => set({ clientId }),

  setWebSocketAPI: (api) => set({ webSocketAPI: api }),

  // Simulation actions
  addActiveSimulation: (simulation) =>
    set((state) => ({
      activeSimulations: [...state.activeSimulations, simulation],
    })),

  updateSimulationMetrics: (simulationId, metrics) =>
    set((state) => ({
      activeSimulations: state.activeSimulations.map((sim) =>
        sim.id === simulationId ? { ...sim, ...metrics } : sim
      ),
    })),

  completeSimulation: (simulationId, results) =>
    set((state) => {
      const completedSim = state.activeSimulations.find(
        (sim) => sim.id === simulationId
      );

      if (!completedSim) return state;

      const updatedSim = {
        ...completedSim,
        ...results,
        status: "completed" as const,
        endTime: new Date(),
      };

      return {
        activeSimulations: state.activeSimulations.map((sim) =>
          sim.id === simulationId ? updatedSim : sim
        ),
        simulationHistory: [...state.simulationHistory, updatedSim],
      };
    }),

  removeSimulation: (simulationId) =>
    set((state) => ({
      activeSimulations: state.activeSimulations.filter(
        (sim) => sim.id !== simulationId
      ),
    })),

  updateRealTimeMetrics: (metrics) => {
    set((state) => {
      // Update throughput history (keep last 100 points)
      const throughputHistory = [
        ...(state.realtimeMetrics?.throughputHistory || []),
        metrics.rps,
      ].slice(-100);

      // Update response time history
      const responseTimeHistory = [
        ...(state.realtimeMetrics?.responseTimeHistory || []),
        metrics.responseTime,
      ].slice(-100);

      // Update error rate history
      const errorRateHistory = [
        ...(state.realtimeMetrics?.errorRateHistory || []),
        metrics.errorRate,
      ].slice(-100);

      return {
        realtimeMetrics: {
          ...metrics,
          throughputHistory,
          responseTimeHistory,
          errorRateHistory,
        },
      };
    });
  },

  setSelectedSimulation: (simulation) =>
    set({ selectedSimulation: simulation }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  // Computed values
  getActiveSimulationsCount: () => get().activeSimulations.length,

  getRunningSimulationsCount: () =>
    get().activeSimulations.filter((sim) => sim.status === "running").length,

  getTotalRequests: () =>
    get().activeSimulations.reduce(
      (total, sim) => total + sim.totalRequests,
      0
    ),

  getAverageRPS: () => {
    const { activeSimulations } = get();
    if (activeSimulations.length === 0) return 0;

    const totalRPS = activeSimulations.reduce(
      (total, sim) => total + sim.currentRPS,
      0
    );
    return Math.round(totalRPS / activeSimulations.length);
  },

  getOverallSuccessRate: () => {
    const { activeSimulations } = get();
    const totalRequests = activeSimulations.reduce(
      (total, sim) => total + sim.totalRequests,
      0
    );
    const totalSuccessful = activeSimulations.reduce(
      (total, sim) => total + sim.successfulRequests,
      0
    );

    return totalRequests > 0
      ? Math.round((totalSuccessful / totalRequests) * 100)
      : 0;
  },
}));

// Export actions for external use (like in useWebSocket)
export const simulatorActions = {
  setConnectionStatus: (
    status: "disconnected" | "connecting" | "connected" | "error"
  ) => useSimulatorStore.getState().setConnectionStatus(status),
  setClientId: (clientId: string) =>
    useSimulatorStore.getState().setClientId(clientId),
  setWebSocketAPI: (api: WebSocketAPI) =>
    useSimulatorStore.getState().setWebSocketAPI(api),
  addActiveSimulation: (simulation: SimulationStatus) =>
    useSimulatorStore.getState().addActiveSimulation(simulation),
  updateSimulationMetrics: (
    simulationId: number,
    metrics: Partial<SimulationStatus>
  ) =>
    useSimulatorStore.getState().updateSimulationMetrics(simulationId, metrics),
  completeSimulation: (simulationId: number, results: any) =>
    useSimulatorStore.getState().completeSimulation(simulationId, results),
  updateRealTimeMetrics: (metrics: RealtimeMetrics) =>
    useSimulatorStore.getState().updateRealTimeMetrics(metrics),
};

// Backward compatibility
export const simulatorStore = useSimulatorStore;

// Export types for external use
export type { SimulationStatus, RealtimeMetrics, WebSocketAPI };
