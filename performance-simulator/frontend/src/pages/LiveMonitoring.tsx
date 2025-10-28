import React, { useState, useEffect } from "react";
import {
  Typography,
  Box,
  Card,
  CardContent,
  Grid,
  Chip,
  LinearProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
} from "@mui/material";
import {
  Speed,
  Timeline,
  Stop,
  Refresh,
  Visibility,
  Error as ErrorIcon,
  CheckCircle,
  Warning,
} from "@mui/icons-material";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
} from "chart.js";
import { useSimulatorStore } from "../stores/simulatorStore";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  Legend
);

interface LiveMetrics {
  timestamp: string;
  rps: number;
  response_time: number;
  error_rate: number;
  active_users: number;
}

interface ActiveSimulation {
  id: string;
  name: string;
  status: string;
  start_time: string;
  current_rps: number;
  target_rps: number;
  total_requests: number;
  successful_reqs: number;
  failed_requests: number;
  config: {
    max_rps: number;
    pattern: string;
    scale_mode: string;
  };
}

const LiveMonitoring: React.FC = () => {
  const [activeSimulations, setActiveSimulations] = useState<ActiveSimulation[]>([]);
  const [selectedSimulation, setSelectedSimulation] = useState<string | null>(null);
  const [liveMetrics, setLiveMetrics] = useState<LiveMetrics[]>([]);
  const [systemHealth, setSystemHealth] = useState<{
    cpu_usage: number;
    memory_usage: number;
    active_connections: number;
    database_status: string;
    redis_status: string;
  }>({
    cpu_usage: 0,
    memory_usage: 0,
    active_connections: 0,
    database_status: "unknown",
    redis_status: "unknown",
  });

  const connectionStatus = useSimulatorStore((state) => state.connectionStatus);
  const realtimeMetrics = useSimulatorStore((state) => state.realtimeMetrics);

  useEffect(() => {
    // Load active simulations
    loadActiveSimulations();
    
    // Set up periodic refresh
    const interval = setInterval(() => {
      loadActiveSimulations();
      updateSystemHealth();
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  // Update live metrics from WebSocket
  useEffect(() => {
    if (realtimeMetrics) {
      const newMetric: LiveMetrics = {
        timestamp: new Date().toISOString(),
        rps: realtimeMetrics.rps || 0,
        response_time: realtimeMetrics.responseTime || 0,
        error_rate: realtimeMetrics.errorRate || 0,
        active_users: realtimeMetrics.activeConnections || 0,
      };

      setLiveMetrics(prev => {
        const updated = [...prev, newMetric];
        // Keep only last 100 points
        return updated.slice(-100);
      });
    }
  }, [realtimeMetrics]);

  const loadActiveSimulations = async (): Promise<void> => {
    try {
      const response = await fetch("/api/v1/simulations");
      const data = await response.json();
      const active = (data.simulations || []).filter((sim: ActiveSimulation) => 
        sim.status === "running"
      );
      setActiveSimulations(active);
      
      // Auto-select first active simulation if none selected
      if (!selectedSimulation && active.length > 0) {
        setSelectedSimulation(active[0].id);
      }
    } catch (error) {
      console.error("Failed to load active simulations:", error);
    }
  };

  const updateSystemHealth = (): void => {
    // Mock system health data - in production, this would come from actual metrics
    setSystemHealth({
      cpu_usage: 30 + Math.random() * 40, // 30-70%
      memory_usage: 40 + Math.random() * 30, // 40-70%
      active_connections: Math.floor(50 + Math.random() * 200), // 50-250 connections
      database_status: Math.random() > 0.1 ? "healthy" : "warning", // 90% healthy
      redis_status: Math.random() > 0.05 ? "healthy" : "error", // 95% healthy
    });
  };

  const stopSimulation = async (simulationId: string): Promise<void> => {
    try {
      await fetch(`/api/v1/simulations/${simulationId}/stop`, { method: "POST" });
      loadActiveSimulations(); // Refresh the list
    } catch (error) {
      console.error("Failed to stop simulation:", error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "running": return "success";
      case "stopped": return "warning";
      case "failed": return "error";
      default: return "default";
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case "healthy": return <CheckCircle color="success" />;
      case "warning": return <Warning color="warning" />;
      case "error": return <ErrorIcon color="error" />;
      default: return <Warning color="disabled" />;
    }
  };

  // Chart data for live metrics
  const metricsChartData = {
    labels: liveMetrics.map(m => new Date(m.timestamp).toLocaleTimeString()),
    datasets: [
      {
        label: "RPS",
        data: liveMetrics.map(m => m.rps),
        borderColor: "rgba(75, 192, 192, 1)",
        backgroundColor: "rgba(75, 192, 192, 0.2)",
        yAxisID: "y",
        tension: 0.4,
      },
      {
        label: "Response Time (ms)",
        data: liveMetrics.map(m => m.response_time),
        borderColor: "rgba(255, 99, 132, 1)",
        backgroundColor: "rgba(255, 99, 132, 0.2)",
        yAxisID: "y1",
        tension: 0.4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index" as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: "top" as const,
      },
      title: {
        display: true,
        text: "Real-time Performance Metrics",
      },
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: "Time",
        },
      },
      y: {
        type: "linear" as const,
        display: true,
        position: "left" as const,
        title: {
          display: true,
          text: "RPS",
        },
      },
      y1: {
        type: "linear" as const,
        display: true,
        position: "right" as const,
        title: {
          display: true,
          text: "Response Time (ms)",
        },
        grid: {
          drawOnChartArea: false,
        },
      },
    },
  };

  const selectedSim = activeSimulations.find(sim => sim.id === selectedSimulation);

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h4" component="h1">
          <Speed sx={{ mr: 1, verticalAlign: "bottom" }} />
          Live Performance Monitoring
        </Typography>
        <Chip
          icon={connectionStatus === "connected" ? <CheckCircle /> : <ErrorIcon />}
          label={`WebSocket: ${connectionStatus}`}
          color={connectionStatus === "connected" ? "success" : "error"}
        />
      </Box>

      {/* System Health Overview */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            System Health Overview
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={6} md={3}>
              <Box>
                <Typography variant="body2" color="textSecondary">
                  CPU Usage
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={systemHealth.cpu_usage} 
                  color={systemHealth.cpu_usage > 80 ? "error" : systemHealth.cpu_usage > 60 ? "warning" : "success"}
                  sx={{ height: 8, borderRadius: 4, mb: 1 }}
                />
                <Typography variant="h6">
                  {systemHealth.cpu_usage.toFixed(1)}%
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} md={3}>
              <Box>
                <Typography variant="body2" color="textSecondary">
                  Memory Usage
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={systemHealth.memory_usage} 
                  color={systemHealth.memory_usage > 80 ? "error" : systemHealth.memory_usage > 60 ? "warning" : "success"}
                  sx={{ height: 8, borderRadius: 4, mb: 1 }}
                />
                <Typography variant="h6">
                  {systemHealth.memory_usage.toFixed(1)}%
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} md={2}>
              <Box sx={{ textAlign: "center" }}>
                <Typography variant="body2" color="textSecondary">
                  Active Connections
                </Typography>
                <Typography variant="h6">
                  {systemHealth.active_connections}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} md={2}>
              <Box sx={{ textAlign: "center" }}>
                <Typography variant="body2" color="textSecondary">
                  Database
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {getHealthIcon(systemHealth.database_status)}
                  <Typography variant="body2" sx={{ ml: 1 }}>
                    {systemHealth.database_status}
                  </Typography>
                </Box>
              </Box>
            </Grid>
            <Grid item xs={6} md={2}>
              <Box sx={{ textAlign: "center" }}>
                <Typography variant="body2" color="textSecondary">
                  Redis
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {getHealthIcon(systemHealth.redis_status)}
                  <Typography variant="body2" sx={{ ml: 1 }}>
                    {systemHealth.redis_status}
                  </Typography>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        {/* Active Simulations Table */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                <Typography variant="h6">
                  Active Simulations ({activeSimulations.length})
                </Typography>
                <IconButton onClick={loadActiveSimulations} size="small">
                  <Refresh />
                </IconButton>
              </Box>
              
              {activeSimulations.length === 0 ? (
                <Alert severity="info">
                  No active simulations running. Start a simulation to see live monitoring data.
                </Alert>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align="right">Current RPS</TableCell>
                        <TableCell align="center">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {activeSimulations.map((sim) => (
                        <TableRow 
                          key={sim.id} 
                          selected={selectedSimulation === sim.id}
                          hover
                          onClick={() => setSelectedSimulation(sim.id)}
                          sx={{ cursor: "pointer" }}
                        >
                          <TableCell>
                            <Typography variant="body2" fontWeight="medium">
                              {sim.name}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              {sim.config.pattern} - {sim.config.scale_mode}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={sim.status} 
                              color={getStatusColor(sim.status) as any}
                              size="small"
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontWeight="medium">
                              {sim.current_rps.toLocaleString()}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              / {sim.config.max_rps.toLocaleString()}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Tooltip title="View Details">
                              <IconButton size="small" onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSimulation(sim.id);
                              }}>
                                <Visibility />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Stop Simulation">
                              <IconButton 
                                size="small" 
                                color="error"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  stopSimulation(sim.id);
                                }}
                              >
                                <Stop />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Selected Simulation Details */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {selectedSim ? `${selectedSim.name} - Details` : "Select Simulation"}
              </Typography>
              
              {selectedSim ? (
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Box>
                      <Typography variant="body2" color="textSecondary">
                        Current RPS
                      </Typography>
                      <Typography variant="h5" color="primary">
                        {selectedSim.current_rps.toLocaleString()}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box>
                      <Typography variant="body2" color="textSecondary">
                        Target RPS
                      </Typography>
                      <Typography variant="h5">
                        {selectedSim.target_rps?.toLocaleString() || "N/A"}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box>
                      <Typography variant="body2" color="textSecondary">
                        Total Requests
                      </Typography>
                      <Typography variant="h6">
                        {selectedSim.total_requests.toLocaleString()}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box>
                      <Typography variant="body2" color="textSecondary">
                        Success Rate
                      </Typography>
                      <Typography variant="h6" color="success.main">
                        {((selectedSim.successful_reqs / selectedSim.total_requests) * 100 || 0).toFixed(1)}%
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12}>
                    <Box>
                      <Typography variant="body2" color="textSecondary" gutterBottom>
                        Progress ({((selectedSim.current_rps / selectedSim.config.max_rps) * 100).toFixed(1)}%)
                      </Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={(selectedSim.current_rps / selectedSim.config.max_rps) * 100}
                        sx={{ height: 8, borderRadius: 4 }}
                      />
                    </Box>
                  </Grid>
                </Grid>
              ) : (
                <Alert severity="info">
                  Click on a simulation in the table to view its details
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Real-time Metrics Chart */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <Timeline sx={{ mr: 1 }} />
                Real-time Performance Metrics
              </Typography>
              
              {liveMetrics.length > 0 ? (
                <Box sx={{ height: 400 }}>
                  <Line data={metricsChartData} options={chartOptions} />
                </Box>
              ) : (
                <Alert severity="info" sx={{ mt: 2 }}>
                  No live metrics available. Start a simulation to see real-time performance data.
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default LiveMonitoring;
