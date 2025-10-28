import React, { useState, useEffect } from "react";
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Chip,
  LinearProgress,
  IconButton,
  Tooltip,
} from "@mui/material";
import {
  PlayArrow,
  Refresh,
  TrendingUp,
  Speed,
  ErrorOutline,
  Timer,
  People,
} from "@mui/icons-material";
import { Line, Bar, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  ArcElement,
} from "chart.js";

import { useSimulatorStore } from "../stores/simulatorStore";
import { useNavigate } from "react-router-dom";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  ChartTooltip,
  Legend,
  ArcElement
);

interface DashboardStats {
  totalSimulations: number;
  activeSimulations: number;
  avgRPS: number;
  avgResponseTime: number;
  successRate: number;
  totalRequests: number;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalSimulations: 0,
    activeSimulations: 0,
    avgRPS: 0,
    avgResponseTime: 0,
    successRate: 0,
    totalRequests: 0,
  });

  const activeSimulations = useSimulatorStore(
    (state) => state.activeSimulations
  );
  const realtimeMetrics = useSimulatorStore((state) => state.realtimeMetrics);
  const connectionStatus = useSimulatorStore((state) => state.connectionStatus);
  const webSocketAPI = useSimulatorStore((state) => state.webSocketAPI);

  // Mock performance comparison data for Go vs Java services
  const serviceComparisonData = {
    labels: [
      "Auth (Java)",
      "Control Plane (Go)",
      "Chat (Go)",
      "Notification (Go)",
      "Billing (Java)",
    ],
    datasets: [
      {
        label: "Requests/Second",
        data: [12000, 45000, 40000, 35000, 15000],
        backgroundColor: [
          "rgba(255, 193, 7, 0.8)", // Java - Amber
          "rgba(76, 175, 80, 0.8)", // Go - Green
          "rgba(76, 175, 80, 0.8)", // Go - Green
          "rgba(76, 175, 80, 0.8)", // Go - Green
          "rgba(255, 193, 7, 0.8)", // Java - Amber
        ],
        borderColor: [
          "rgba(255, 193, 7, 1)",
          "rgba(76, 175, 80, 1)",
          "rgba(76, 175, 80, 1)",
          "rgba(76, 175, 80, 1)",
          "rgba(255, 193, 7, 1)",
        ],
        borderWidth: 2,
      },
    ],
  };

  // Real-time throughput chart data
  const throughputData = {
    labels: Array.from({ length: 20 }, (_, i) => `${i * 5}s`),
    datasets: [
      {
        label: "RPS",
        data: realtimeMetrics?.throughputHistory || Array(20).fill(0),
        borderColor: "rgba(33, 150, 243, 1)",
        backgroundColor: "rgba(33, 150, 243, 0.2)",
        borderWidth: 2,
        fill: true,
        tension: 0.4,
      },
    ],
  };

  // Response time distribution
  const responseTimeData = {
    labels: ["< 100ms", "100-200ms", "200-500ms", "500ms-1s", "> 1s"],
    datasets: [
      {
        data: [45, 30, 15, 8, 2],
        backgroundColor: [
          "rgba(76, 175, 80, 0.8)",
          "rgba(139, 195, 74, 0.8)",
          "rgba(255, 193, 7, 0.8)",
          "rgba(255, 152, 0, 0.8)",
          "rgba(244, 67, 54, 0.8)",
        ],
        borderWidth: 0,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: "#ffffff",
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: "#b0bec5",
        },
        grid: {
          color: "rgba(255, 255, 255, 0.1)",
        },
      },
      y: {
        ticks: {
          color: "#b0bec5",
        },
        grid: {
          color: "rgba(255, 255, 255, 0.1)",
        },
      },
    },
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: {
          color: "#ffffff",
          padding: 20,
        },
      },
    },
  };

  useEffect(() => {
    // Update stats based on active simulations
    if (activeSimulations.length > 0) {
      const totalRequests = activeSimulations.reduce(
        (sum, sim) => sum + (sim.totalRequests || 0),
        0
      );
      const totalSuccessful = activeSimulations.reduce(
        (sum, sim) => sum + (sim.successfulRequests || 0),
        0
      );
      const avgRPS =
        activeSimulations.reduce((sum, sim) => sum + (sim.currentRPS || 0), 0) /
        activeSimulations.length;
      const avgResponseTime =
        activeSimulations.reduce(
          (sum, sim) => sum + (sim.avgResponseTime || 0),
          0
        ) / activeSimulations.length;

      setStats({
        totalSimulations: activeSimulations.length,
        activeSimulations: activeSimulations.filter(
          (sim) => sim.status === "running"
        ).length,
        avgRPS: Math.round(avgRPS),
        avgResponseTime: Math.round(avgResponseTime),
        successRate:
          totalRequests > 0
            ? Math.round((totalSuccessful / totalRequests) * 100)
            : 0,
        totalRequests,
      });
    }
  }, [activeSimulations, realtimeMetrics]);

  const handleStartQuickTest = () => {
    navigate("/simulation/config");
  };

  const handleViewComparison = () => {
    navigate("/comparison");
  };

  const handleRefreshData = () => {
    webSocketAPI?.getStatus();
    // Refresh data logic here
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
        }}
      >
        <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
          Performance Dashboard
        </Typography>
        <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
          <Chip
            label={connectionStatus}
            color={connectionStatus === "connected" ? "success" : "error"}
            size="small"
          />
          <Tooltip title="Refresh Data">
            <IconButton onClick={handleRefreshData} color="primary">
              <Refresh />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<PlayArrow />}
            onClick={handleStartQuickTest}
            sx={{ ml: 1 }}
          >
            Start New Test
          </Button>
        </Box>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {[
          {
            title: "Active Simulations",
            value: stats.activeSimulations,
            icon: <Speed />,
            color: "primary.main",
          },
          {
            title: "Average RPS",
            value: stats.avgRPS.toLocaleString(),
            icon: <TrendingUp />,
            color: "success.main",
          },
          {
            title: "Avg Response Time",
            value: `${stats.avgResponseTime}ms`,
            icon: <Timer />,
            color: "warning.main",
          },
          {
            title: "Success Rate",
            value: `${stats.successRate}%`,
            icon: <People />,
            color: "info.main",
          },
        ].map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card sx={{ height: "100%" }}>
              <CardContent>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Box>
                    <Typography
                      color="text.secondary"
                      gutterBottom
                      variant="h6"
                    >
                      {stat.title}
                    </Typography>
                    <Typography
                      variant="h4"
                      component="div"
                      sx={{ color: stat.color, fontWeight: 600 }}
                    >
                      {stat.value}
                    </Typography>
                  </Box>
                  <Box sx={{ color: stat.color, opacity: 0.7 }}>
                    {stat.icon}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Charts Row 1 */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Service Performance Comparison */}
        <Grid item xs={12} md={8}>
          <Card sx={{ height: 400 }}>
            <CardContent>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  mb: 2,
                }}
              >
                <Typography variant="h6" component="h2">
                  Service Performance Comparison
                </Typography>
                <Button size="small" onClick={handleViewComparison}>
                  View Details
                </Button>
              </Box>
              <Box sx={{ height: 300 }}>
                <Bar data={serviceComparisonData} options={chartOptions} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Response Time Distribution */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: 400 }}>
            <CardContent>
              <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
                Response Time Distribution
              </Typography>
              <Box sx={{ height: 300 }}>
                <Doughnut data={responseTimeData} options={doughnutOptions} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts Row 2 */}
      <Grid container spacing={3}>
        {/* Real-time Throughput */}
        <Grid item xs={12} md={8}>
          <Card sx={{ height: 400 }}>
            <CardContent>
              <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
                Real-time Throughput (Last 100 seconds)
              </Typography>
              <Box sx={{ height: 300 }}>
                <Line data={throughputData} options={chartOptions} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Active Simulations */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: 400 }}>
            <CardContent>
              <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
                Active Simulations
              </Typography>
              <Box sx={{ maxHeight: 300, overflowY: "auto" }}>
                {activeSimulations.length > 0 ? (
                  activeSimulations.map((simulation, index) => (
                    <Box
                      key={index}
                      sx={{
                        p: 2,
                        mb: 1,
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        borderRadius: 1,
                        backgroundColor: "rgba(255, 255, 255, 0.02)",
                      }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          mb: 1,
                        }}
                      >
                        <Typography
                          variant="subtitle2"
                          sx={{ fontWeight: 600 }}
                        >
                          {simulation.name || `Simulation ${simulation.id}`}
                        </Typography>
                        <Chip
                          label={simulation.status}
                          size="small"
                          color={
                            simulation.status === "running"
                              ? "success"
                              : "default"
                          }
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        RPS: {simulation.currentRPS || 0} | Requests:{" "}
                        {simulation.totalRequests || 0}
                      </Typography>
                      {simulation.status === "running" && (
                        <LinearProgress
                          variant="indeterminate"
                          sx={{ mt: 1, height: 2, borderRadius: 1 }}
                        />
                      )}
                    </Box>
                  ))
                ) : (
                  <Box sx={{ textAlign: "center", py: 4 }}>
                    <ErrorOutline
                      sx={{ fontSize: 48, color: "text.secondary", mb: 2 }}
                    />
                    <Typography color="text.secondary">
                      No active simulations
                    </Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={handleStartQuickTest}
                      sx={{ mt: 2 }}
                    >
                      Start Your First Test
                    </Button>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
