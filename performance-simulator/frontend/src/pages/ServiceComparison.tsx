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
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
} from "@mui/material";
import {
  Compare,
  PlayArrow,
  Speed,
  Timer,
  TrendingUp,
  Error as ErrorIcon,
} from "@mui/icons-material";
import { Bar, Radar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  RadialLinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import axios from "axios";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  RadialLinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ServiceProfile {
  name: string;
  technology: string;
  base_url: string;
  endpoints: { path: string; method: string }[];
  expected_rps: number;
  expected_p95_latency: string;
  characteristics: {
    type: string;
    bottleneck: string;
    scaling: string;
  };
}

interface ComparisonResult {
  service: string;
  technology: string;
  actual_rps: number;
  expected_rps: number;
  avg_response_time: number;
  p95_response_time: number;
  error_rate: number;
  efficiency_score: number;
}

const ServiceComparison: React.FC = () => {
  const [serviceProfiles, setServiceProfiles] = useState<Record<string, ServiceProfile>>({});
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [comparisonResults, setComparisonResults] = useState<ComparisonResult[]>([]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  // Load service profiles on component mount
  useEffect(() => {
    loadServiceProfiles();
  }, []);

  const loadServiceProfiles = async (): Promise<void> => {
    try {
      const response = await axios.get("/api/v1/services");
      setServiceProfiles(response.data.service_profiles || {});
    } catch (err) {
      console.error("Failed to load service profiles:", err);
      setError("Failed to load service profiles");
    }
  };

  const runComparison = async (): Promise<void> => {
    if (selectedServices.length < 2) {
      setError("Please select at least 2 services to compare");
      return;
    }

    setIsRunning(true);
    setError("");

    try {
      // Mock comparison results for demonstration
      // In production, this would run actual performance tests
      const mockResults: ComparisonResult[] = selectedServices.map((serviceKey) => {
        const profile = serviceProfiles[serviceKey];
        const variation = 0.8 + Math.random() * 0.4; // ±20% variation
        
        return {
          service: profile.name,
          technology: profile.technology,
          actual_rps: Math.floor(profile.expected_rps * variation),
          expected_rps: profile.expected_rps,
          avg_response_time: profile.technology.includes("Go") ? 25 + Math.random() * 30 : 80 + Math.random() * 60,
          p95_response_time: profile.technology.includes("Go") ? 45 + Math.random() * 50 : 120 + Math.random() * 100,
          error_rate: Math.random() * 2, // 0-2% error rate
          efficiency_score: Math.floor((profile.expected_rps * variation / profile.expected_rps) * 100),
        };
      });

      setComparisonResults(mockResults);
    } catch (err) {
      setError("Failed to run comparison");
    } finally {
      setIsRunning(false);
    }
  };

  // Chart data for RPS comparison
  const rpsComparisonData = {
    labels: comparisonResults.map((result) => result.service),
    datasets: [
      {
        label: "Expected RPS",
        data: comparisonResults.map((result) => result.expected_rps),
        backgroundColor: "rgba(255, 193, 7, 0.8)",
        borderColor: "rgba(255, 193, 7, 1)",
        borderWidth: 2,
      },
      {
        label: "Actual RPS",
        data: comparisonResults.map((result) => result.actual_rps),
        backgroundColor: comparisonResults.map((result) =>
          result.technology.includes("Go") ? "rgba(76, 175, 80, 0.8)" : "rgba(33, 150, 243, 0.8)"
        ),
        borderColor: comparisonResults.map((result) =>
          result.technology.includes("Go") ? "rgba(76, 175, 80, 1)" : "rgba(33, 150, 243, 1)"
        ),
        borderWidth: 2,
      },
    ],
  };

  // Radar chart for comprehensive comparison
  const radarData = {
    labels: ["RPS Performance", "Low Latency", "Efficiency", "Reliability", "Scalability"],
    datasets: comparisonResults.map((result) => ({
      label: result.service,
      data: [
        (result.actual_rps / Math.max(...comparisonResults.map(r => r.expected_rps))) * 100,
        Math.max(0, 100 - result.avg_response_time),
        result.efficiency_score,
        Math.max(0, 100 - result.error_rate * 50),
        result.technology.includes("Go") ? 95 : 85, // Mock scalability score
      ],
      backgroundColor: result.technology.includes("Go") 
        ? `rgba(76, 175, 80, 0.2)` 
        : `rgba(33, 150, 243, 0.2)`,
      borderColor: result.technology.includes("Go") 
        ? `rgba(76, 175, 80, 1)` 
        : `rgba(33, 150, 243, 1)`,
      borderWidth: 2,
    })),
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
      },
      title: {
        display: true,
        text: "Service Performance Comparison",
      },
    },
  };

  const radarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        angleLines: {
          display: true,
        },
        suggestedMin: 0,
        suggestedMax: 100,
      },
    },
    plugins: {
      legend: {
        position: "top" as const,
      },
      title: {
        display: true,
        text: "Comprehensive Performance Radar",
      },
    },
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 3 }}>
        <Compare sx={{ mr: 1, verticalAlign: "bottom" }} />
        Service Performance Comparison
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Service Selection */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Select Services to Compare
          </Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={8}>
              <FormControl fullWidth>
                <InputLabel>Services</InputLabel>
                <Select
                  multiple
                  value={selectedServices}
                  onChange={(e) => setSelectedServices(e.target.value as string[])}
                  renderValue={(selected) => (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                      {selected.map((value) => (
                        <Chip key={value} label={serviceProfiles[value]?.name || value} />
                      ))}
                    </Box>
                  )}
                >
                  {Object.entries(serviceProfiles).map(([key, profile]) => (
                    <MenuItem key={key} value={key}>
                      {profile.name} ({profile.technology})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <Button
                variant="contained"
                color="primary"
                startIcon={<PlayArrow />}
                onClick={runComparison}
                disabled={isRunning || selectedServices.length < 2}
                fullWidth
              >
                {isRunning ? "Running Comparison..." : "Run Comparison"}
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Results Table */}
      {comparisonResults.length > 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <Speed sx={{ mr: 1 }} />
                  Performance Comparison Results
                </Typography>
                <TableContainer component={Paper}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Service</TableCell>
                        <TableCell>Technology</TableCell>
                        <TableCell align="right">Expected RPS</TableCell>
                        <TableCell align="right">Actual RPS</TableCell>
                        <TableCell align="right">Avg Response Time</TableCell>
                        <TableCell align="right">P95 Response Time</TableCell>
                        <TableCell align="right">Error Rate</TableCell>
                        <TableCell align="right">Efficiency</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {comparisonResults.map((result, index) => (
                        <TableRow key={index}>
                          <TableCell component="th" scope="row">
                            {result.service}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={result.technology}
                              color={result.technology.includes("Go") ? "success" : "primary"}
                              size="small"
                            />
                          </TableCell>
                          <TableCell align="right">{result.expected_rps.toLocaleString()}</TableCell>
                          <TableCell align="right">
                            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                              {result.actual_rps.toLocaleString()}
                              {result.actual_rps >= result.expected_rps ? (
                                <TrendingUp sx={{ ml: 1, color: "green" }} />
                              ) : (
                                <ErrorIcon sx={{ ml: 1, color: "orange" }} />
                              )}
                            </Box>
                          </TableCell>
                          <TableCell align="right">{result.avg_response_time.toFixed(1)}ms</TableCell>
                          <TableCell align="right">{result.p95_response_time.toFixed(1)}ms</TableCell>
                          <TableCell align="right">{result.error_rate.toFixed(2)}%</TableCell>
                          <TableCell align="right">
                            <Chip
                              label={`${result.efficiency_score}%`}
                              color={result.efficiency_score >= 90 ? "success" : result.efficiency_score >= 75 ? "warning" : "error"}
                              size="small"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* RPS Comparison Chart */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  RPS Performance Comparison
                </Typography>
                <Box sx={{ height: 300 }}>
                  <Bar data={rpsComparisonData} options={chartOptions} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Radar Chart */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Performance Radar
                </Typography>
                <Box sx={{ height: 300 }}>
                  <Radar data={radarData} options={radarOptions} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Technology Analysis */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <Timer sx={{ mr: 1 }} />
                  Technology Analysis Summary
                </Typography>
                <Grid container spacing={2}>
                  {Object.entries(
                    comparisonResults.reduce((acc, result) => {
                      const tech = result.technology.includes("Go") ? "Go" : "Java";
                      if (!acc[tech]) {
                        acc[tech] = { services: [], avg_rps: 0, avg_latency: 0 };
                      }
                      acc[tech].services.push(result.service);
                      acc[tech].avg_rps += result.actual_rps;
                      acc[tech].avg_latency += result.avg_response_time;
                      return acc;
                    }, {} as Record<string, { services: string[]; avg_rps: number; avg_latency: number }>)
                  ).map(([tech, data]) => {
                    const serviceCount = data.services.length;
                    const avgRps = Math.floor(data.avg_rps / serviceCount);
                    const avgLatency = (data.avg_latency / serviceCount).toFixed(1);
                    
                    return (
                      <Grid item xs={12} md={6} key={tech}>
                        <Card variant="outlined">
                          <CardContent>
                            <Typography variant="h6" color={tech === "Go" ? "success.main" : "primary.main"}>
                              {tech} Services
                            </Typography>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                              {data.services.join(", ")}
                            </Typography>
                            <Typography variant="body1">
                              <strong>Average RPS:</strong> {avgRps.toLocaleString()}
                            </Typography>
                            <Typography variant="body1">
                              <strong>Average Latency:</strong> {avgLatency}ms
                            </Typography>
                            <Typography variant="body1">
                              <strong>Performance:</strong>{" "}
                              <Chip
                                label={tech === "Go" ? "High Throughput, Low Latency" : "Stable, Feature Rich"}
                                color={tech === "Go" ? "success" : "primary"}
                                size="small"
                              />
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                    );
                  })}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default ServiceComparison;
