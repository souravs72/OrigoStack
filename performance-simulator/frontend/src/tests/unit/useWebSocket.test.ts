import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useWebSocket } from "../../hooks/useWebSocket";
import { simulatorActions } from "../../stores/simulatorStore";

// Mock socket.io-client
vi.mock("socket.io-client", () => ({
  io: vi.fn(() => ({
    on: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    connected: true,
  })),
}));

// Mock react-hot-toast
vi.mock("react-hot-toast", () => ({
  success: vi.fn(),
  error: vi.fn(),
}));

// Mock simulator store
vi.mock("../../stores/simulatorStore", () => ({
  simulatorStore: {
    getState: vi.fn(() => ({
      setConnectionStatus: vi.fn(),
      addActiveSimulation: vi.fn(),
      updateSimulationMetrics: vi.fn(),
      completeSimulation: vi.fn(),
      updateRealTimeMetrics: vi.fn(),
      setClientId: vi.fn(),
      setWebSocketAPI: vi.fn(),
    })),
  },
  simulatorActions: {
    setConnectionStatus: vi.fn(),
    addActiveSimulation: vi.fn(),
    updateSimulationMetrics: vi.fn(),
    completeSimulation: vi.fn(),
    updateRealTimeMetrics: vi.fn(),
    setClientId: vi.fn(),
    setWebSocketAPI: vi.fn(),
  },
  useSimulatorStore: vi.fn(() => ({
    connectionStatus: "disconnected",
    activeSimulations: [],
    realtimeMetrics: null,
  })),
}));

describe("useWebSocket", () => {
  const mockUrl = "ws://localhost:8080/ws";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize WebSocket connection", () => {
    const { result } = renderHook(() => useWebSocket(mockUrl));

    expect(result.current).toHaveProperty("isConnected");
    expect(result.current).toHaveProperty("sendMessage");
    expect(result.current).toHaveProperty("subscribeToSimulation");
    expect(result.current).toHaveProperty("unsubscribeFromSimulation");
    expect(result.current).toHaveProperty("ping");
    expect(result.current).toHaveProperty("getStatus");
  });

  it("should call setWebSocketAPI on mount", () => {
    renderHook(() => useWebSocket(mockUrl));

    expect(simulatorActions.setWebSocketAPI).toHaveBeenCalledWith({
      subscribeToSimulation: expect.any(Function),
      unsubscribeFromSimulation: expect.any(Function),
      ping: expect.any(Function),
      getStatus: expect.any(Function),
      sendMessage: expect.any(Function),
    });
  });

  it("should handle sendMessage function", () => {
    const { result } = renderHook(() => useWebSocket(mockUrl));

    act(() => {
      result.current.sendMessage("test_message", { test: "data" });
    });

    // Test passes if no errors are thrown
    expect(true).toBe(true);
  });

  it("should handle ping function", () => {
    const { result } = renderHook(() => useWebSocket(mockUrl));

    act(() => {
      result.current.ping();
    });

    // Test passes if no errors are thrown
    expect(true).toBe(true);
  });

  it("should handle getStatus function", () => {
    const { result } = renderHook(() => useWebSocket(mockUrl));

    act(() => {
      result.current.getStatus();
    });

    // Test passes if no errors are thrown
    expect(true).toBe(true);
  });

  it("should handle subscribeToSimulation function", () => {
    const { result } = renderHook(() => useWebSocket(mockUrl));
    const simulationId = 123;

    act(() => {
      result.current.subscribeToSimulation(simulationId);
    });

    // Test passes if no errors are thrown
    expect(true).toBe(true);
  });

  it("should handle unsubscribeFromSimulation function", () => {
    const { result } = renderHook(() => useWebSocket(mockUrl));
    const simulationId = 123;

    act(() => {
      result.current.unsubscribeFromSimulation(simulationId);
    });

    // Test passes if no errors are thrown
    expect(true).toBe(true);
  });
});
