import React, { useState, useEffect } from "react";
import {
  Typography,
  Box,
  Card,
  CardContent,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import {
  Analytics,
  ExpandMore,
  GetApp,
  Speed,
  Timeline,
  Assessment,
  PieChart,
  Timer,
} from "@mui/icons-material";
import { Line, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import axios from "axios";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface SimulationResult {
  id: string;
  name: string;
  status: string;
  start_time: string;
  end_time?: string;
  total_requests: number;
  successful_reqs: number;
  failed_requests: number;
  current_rps: number;
  config: {
    target_url: string;
    method: string;
    max_rps: number;
    min_rps: number;
    duration: number;
    pattern: string;
    scale_mode: string;
  };
  response_times?: {
    min: number;
    max: number;
    mean: number;
    p95: number;
    p99: number;
  };
  time_series?: Array<{
    timestamp: string;
    rps: number;
    target_rps: number;
    response_time: number;
    error_rate: number;
  }>;
}

const ResultsAnalysis: React.FC = () => {
  const [simulations, setSimulations] = useState<SimulationResult[]>([]);
  const [selectedSimulation, setSelectedSimulation] = useState<string>("");
  const [selectedResult, setSelectedResult] = useState<SimulationResult | null>(
    null
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  useEffect(() => {
    loadSimulations();
  }, []);

  useEffect(() => {
    if (selectedSimulation) {
      loadSimulationDetails(selectedSimulation);
    }
  }, [selectedSimulation]);

  const loadSimulations = async (): Promise<void> => {
    setLoading(true);
    try {
      const response = await axios.get("/api/v1/simulations");
      setSimulations(response.data.simulations || []);
    } catch (err) {
      console.error("Failed to load simulations:", err);
      setError("Failed to load simulation results");
    } finally {
      setLoading(false);
    }
  };

  const loadSimulationDetails = async (simulationId: string): Promise<void> => {
    try {
      const response = await axios.get(`/api/v1/simulations/${simulationId}`);
      setSelectedResult(response.data);
    } catch (err) {
      console.error("Failed to load simulation details:", err);
      setError("Failed to load simulation details");
    }
  };

  const exportResults = (): void => {
    if (!selectedResult) return;

    const exportData = {
      simulation: selectedResult,
      export_timestamp: new Date().toISOString(),
      performance_summary: generatePerformanceSummary(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `simulation-${selectedResult.id}-results.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const generatePerformanceSummary = () => {
    if (!selectedResult) return {};

    const timeSeries = selectedResult.time_series || [];
    const totalDuration = selectedResult.config.duration / 1000000000; // Convert from nanoseconds to seconds
    const avgRps = selectedResult.total_requests / totalDuration;
    const successRate =
      (selectedResult.successful_reqs / selectedResult.total_requests) * 100;
    const errorRate =
      (selectedResult.failed_requests / selectedResult.total_requests) * 100;

    return {
      average_rps: Math.round(avgRps),
      peak_rps: Math.max(...timeSeries.map((p) => p.rps)),
      success_rate: Math.round(successRate * 100) / 100,
      error_rate: Math.round(errorRate * 100) / 100,
      duration_seconds: Math.round(totalDuration),
      efficiency_score: Math.min(
        100,
        Math.round((avgRps / selectedResult.config.max_rps) * 100)
      ),
    };
  };

  const filteredSimulations = simulations.filter(
    (sim) => filterStatus === "all" || sim.status === filterStatus
  );

  // Chart data for RPS over time
  const rpsChartData = selectedResult?.time_series
    ? {
        labels: selectedResult.time_series.map((p) =>
          new Date(p.timestamp).toLocaleTimeString()
        ),
        datasets: [
          {
            label: "Actual RPS",
            data: selectedResult.time_series.map((p) => p.rps),
            borderColor: "rgba(75, 192, 192, 1)",
            backgroundColor: "rgba(75, 192, 192, 0.2)",
            tension: 0.4,
          },
          {
            label: "Target RPS",
            data: selectedResult.time_series.map((p) => p.target_rps),
            borderColor: "rgba(255, 99, 132, 1)",
            backgroundColor: "rgba(255, 99, 132, 0.2)",
            borderDash: [5, 5],
            tension: 0.4,
          },
        ],
      }
    : { labels: [], datasets: [] };

  // Response time distribution chart
  const responseTimeData = selectedResult?.time_series
    ? {
        labels: selectedResult.time_series.map((p) =>
          new Date(p.timestamp).toLocaleTimeString()
        ),
        datasets: [
          {
            label: "Response Time (ms)",
            data: selectedResult.time_series.map((p) => p.response_time),
            borderColor: "rgba(54, 162, 235, 1)",
            backgroundColor: "rgba(54, 162, 235, 0.2)",
            tension: 0.4,
          },
        ],
      }
    : { labels: [], datasets: [] };

  // Success/Failure distribution
  const statusData = selectedResult
    ? {
        labels: ["Successful Requests", "Failed Requests"],
        datasets: [
          {
            data: [
              selectedResult.successful_reqs,
              selectedResult.failed_requests,
            ],
            backgroundColor: [
              "rgba(76, 175, 80, 0.8)",
              "rgba(244, 67, 54, 0.8)",
            ],
            borderColor: ["rgba(76, 175, 80, 1)", "rgba(244, 67, 54, 1)"],
            borderWidth: 2,
          },
        ],
      }
    : { labels: [], datasets: [] };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
      },
    },
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 3 }}>
        <Analytics sx={{ mr: 1, verticalAlign: "bottom" }} />
        Results Analysis
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Simulation Selection */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Select Simulation Results
          </Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Filter by Status</InputLabel>
                <Select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <MenuItem value="all">All Simulations</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="running">Running</MenuItem>
                  <MenuItem value="stopped">Stopped</MenuItem>
                  <MenuItem value="failed">Failed</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Simulation</InputLabel>
                <Select
                  value={selectedSimulation}
                  onChange={(e) => setSelectedSimulation(e.target.value)}
                >
                  {filteredSimulations.map((sim) => (
                    <MenuItem key={sim.id} value={sim.id}>
                      {sim.name} -{" "}
                      {new Date(sim.start_time).toLocaleDateString()} (
                      {sim.status})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <Button
                variant="outlined"
                startIcon={<GetApp />}
                onClick={exportResults}
                disabled={!selectedResult}
                fullWidth
              >
                Export
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Results Display */}
      {selectedResult && (
        <Grid container spacing={3}>
          {/* Performance Summary */}
          <Grid item xs={12}>
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="h6">
                  <Assessment sx={{ mr: 1 }} />
                  Performance Summary
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={3}>
                  {Object.entries(generatePerformanceSummary()).map(
                    ([key, value]) => (
                      <Grid item xs={6} md={2} key={key}>
                        <Card variant="outlined">
                          <CardContent sx={{ textAlign: "center", p: 2 }}>
                            <Typography variant="caption" color="textSecondary">
                              {key.replace(/_/g, " ").toUpperCase()}
                            </Typography>
                            <Typography variant="h6" color="primary">
                              {typeof value === "number"
                                ? key.includes("rate") || key.includes("score")
                                  ? `${value}%`
                                  : value.toLocaleString()
                                : value}
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                    )
                  )}
                </Grid>
              </AccordionDetails>
            </Accordion>
          </Grid>

          {/* Configuration Details */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <Speed sx={{ mr: 1 }} />
                  Configuration Details
                </Typography>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell>
                        <strong>Target URL:</strong>
                      </TableCell>
                      <TableCell>{selectedResult.config.target_url}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>
                        <strong>Method:</strong>
                      </TableCell>
                      <TableCell>{selectedResult.config.method}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>
                        <strong>RPS Range:</strong>
                      </TableCell>
                      <TableCell>
                        {selectedResult.config.min_rps.toLocaleString()} -{" "}
                        {selectedResult.config.max_rps.toLocaleString()}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>
                        <strong>Duration:</strong>
                      </TableCell>
                      <TableCell>
                        {Math.round(
                          selectedResult.config.duration / 60000000000
                        )}{" "}
                        minutes
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>
                        <strong>Pattern:</strong>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={selectedResult.config.pattern}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>
                        <strong>Scale Mode:</strong>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={selectedResult.config.scale_mode}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </Grid>

          {/* Response Time Statistics */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <Timer sx={{ mr: 1 }} />
                  Response Time Statistics
                </Typography>
                {selectedResult.response_times ? (
                  <Table size="small">
                    <TableBody>
                      <TableRow>
                        <TableCell>
                          <strong>Min:</strong>
                        </TableCell>
                        <TableCell>
                          {selectedResult.response_times.min.toFixed(2)}ms
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>
                          <strong>Max:</strong>
                        </TableCell>
                        <TableCell>
                          {selectedResult.response_times.max.toFixed(2)}ms
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>
                          <strong>Mean:</strong>
                        </TableCell>
                        <TableCell>
                          {selectedResult.response_times.mean.toFixed(2)}ms
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>
                          <strong>P95:</strong>
                        </TableCell>
                        <TableCell>
                          {selectedResult.response_times.p95.toFixed(2)}ms
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>
                          <strong>P99:</strong>
                        </TableCell>
                        <TableCell>
                          {selectedResult.response_times.p99.toFixed(2)}ms
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                ) : (
                  <Typography variant="body2" color="textSecondary">
                    Response time statistics not available
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* RPS Performance Chart */}
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <Timeline sx={{ mr: 1 }} />
                  RPS Performance Over Time
                </Typography>
                <Box sx={{ height: 300 }}>
                  <Line data={rpsChartData} options={chartOptions} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Success/Failure Distribution */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <PieChart sx={{ mr: 1 }} />
                  Request Status Distribution
                </Typography>
                <Box sx={{ height: 300 }}>
                  <Doughnut data={statusData} options={chartOptions} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Response Time Chart */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Response Time Trend
                </Typography>
                <Box sx={{ height: 300 }}>
                  <Line data={responseTimeData} options={chartOptions} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Empty State */}
      {!selectedResult && !loading && (
        <Card>
          <CardContent sx={{ textAlign: "center", py: 6 }}>
            <Analytics sx={{ fontSize: 64, color: "text.secondary", mb: 2 }} />
            <Typography variant="h6" color="textSecondary">
              Select a simulation to analyze its results
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Choose from the dropdown above to view detailed performance
              analysis
            </Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default ResultsAnalysis;
