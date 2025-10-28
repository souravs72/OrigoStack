import React, { useState, useEffect } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Slider,
  Switch,
  FormControlLabel,
  Chip,
  Alert,
  LinearProgress,
} from "@mui/material";
import {
  PlayArrow,
  Stop,
  Timeline,
  Speed,
  TrendingUp,
  ScatterPlot,
} from "@mui/icons-material";
import { Line } from "react-chartjs-2";
import { useSimulatorStore } from "../stores/simulatorStore";
import axios from "axios";

interface MegaScaleConfig {
  name: string;
  min_rps: number;
  max_rps: number;
  duration: number; // in minutes
  pattern: string;
  scale_mode: string;
  concurrent_users: number;
  target_url: string;
  method: string;
}

interface TimeSeriesPoint {
  timestamp: string;
  rps: number;
  target_rps: number;
  response_time: number;
  error_rate: number;
  active_users: number;
}

const MegaScaleSimulation: React.FC = () => {
  const [config, setConfig] = useState<MegaScaleConfig>({
    name: "Mega Scale Test",
    min_rps: 1,
    max_rps: 1000000,
    duration: 10,
    pattern: "mega_scale",
    scale_mode: "logarithmic",
    concurrent_users: 10000,
    target_url: "http://localhost:8081/api/test",
    method: "GET",
  });

  const [presets, setPresets] = useState<Record<string, MegaScaleConfig>>({});
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [currentSimId, setCurrentSimId] = useState<number | null>(null);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesPoint[]>([]);
  const [error, setError] = useState<string>("");
  const [showRealTime, setShowRealTime] = useState<boolean>(true);

  const connectionStatus = useSimulatorStore((state) => state.connectionStatus);

  // Load presets on component mount
  useEffect(() => {
    loadPresets();
  }, []);

  // Real-time data updates
  useEffect(() => {
    if (currentSimId && showRealTime) {
      const interval = setInterval(() => {
        fetchTimeSeriesData(currentSimId);
      }, 1000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [currentSimId, showRealTime]);

  const loadPresets = async (): Promise<void> => {
    try {
      const response = await axios.get("/api/v1/presets/megascale");
      setPresets(response.data);
    } catch (err) {
      console.error("Failed to load presets:", err);
      setError("Failed to load simulation presets");
    }
  };

  const fetchTimeSeriesData = async (simulationId: number): Promise<void> => {
    try {
      const response = await axios.get(
        `/api/v1/simulations/${simulationId}/timeseries?limit=500`
      );
      setTimeSeriesData(response.data.points || []);
    } catch (err) {
      console.error("Failed to fetch time series data:", err);
    }
  };

  const handlePresetSelect = (presetKey: string): void => {
    if (presets[presetKey]) {
      setConfig({ ...presets[presetKey] });
      setSelectedPreset(presetKey);
    }
    return;
  };

  const startSimulation = async (): Promise<void> => {
    try {
      setError("");
      const response = await axios.post("/api/v1/simulations", {
        ...config,
        duration: `${config.duration}m`, // Convert to Go duration format
      });

      setCurrentSimId(response.data.id);
      setIsRunning(true);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to start simulation");
    }
  };

  const stopSimulation = async (): Promise<void> => {
    if (!currentSimId) return;

    try {
      await axios.post(`/api/v1/simulations/${currentSimId}/stop`);
      setIsRunning(false);
      setCurrentSimId(null);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to stop simulation");
    }
  };

  const formatRPS = (rps: number): string => {
    if (rps >= 1000000) {
      return `${(rps / 1000000).toFixed(1)}M`;
    } else if (rps >= 1000) {
      return `${(rps / 1000).toFixed(1)}K`;
    }
    return rps.toString();
  };

  const getScaleModeDescription = (mode: string): string => {
    const descriptions = {
      linear: "Steady linear increase from min to max RPS",
      logarithmic: "Slow start, rapid acceleration towards the end",
      exponential: "Rapid early growth, then gradual increase",
      step: "Powers of 10 steps (1, 10, 100, 1K, 10K, 100K, 1M)",
    };
    return descriptions[mode as keyof typeof descriptions] || "";
  };

  // Chart configuration for time-series visualization
  const chartData = {
    labels: timeSeriesData.map((point) =>
      new Date(point.timestamp).toLocaleTimeString()
    ),
    datasets: [
      {
        label: "Actual RPS",
        data: timeSeriesData.map((point) => point.rps),
        borderColor: "rgb(75, 192, 192)",
        backgroundColor: "rgba(75, 192, 192, 0.2)",
        borderWidth: 2,
        fill: false,
        tension: 0.1,
      },
      {
        label: "Target RPS",
        data: timeSeriesData.map((point) => point.target_rps),
        borderColor: "rgb(255, 99, 132)",
        backgroundColor: "rgba(255, 99, 132, 0.2)",
        borderWidth: 2,
        fill: false,
        borderDash: [5, 5],
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        type: "logarithmic" as const,
        beginAtZero: false,
        title: {
          display: true,
          text: "Requests per Second (log scale)",
        },
      },
      x: {
        title: {
          display: true,
          text: "Time",
        },
      },
    },
    plugins: {
      legend: {
        position: "top" as const,
      },
      title: {
        display: true,
        text: `Mega-Scale Performance Test: ${config.name}`,
      },
    },
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 3 }}>
        <Speed sx={{ mr: 1, verticalAlign: "bottom" }} />
        Mega-Scale Performance Simulation
      </Typography>

      <Grid container spacing={3}>
        {/* Configuration Panel */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <ScatterPlot sx={{ mr: 1 }} />
                Simulation Configuration
              </Typography>

              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}

              {/* Preset Selection */}
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Load Preset</InputLabel>
                <Select
                  value={selectedPreset}
                  label="Load Preset"
                  onChange={(e) => handlePresetSelect(e.target.value)}
                >
                  <MenuItem value="">Custom Configuration</MenuItem>
                  {Object.entries(presets).map(([key, preset]) => (
                    <MenuItem key={key} value={key}>
                      {preset.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Basic Configuration */}
              <TextField
                fullWidth
                label="Test Name"
                value={config.name}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                label="Target URL"
                value={config.target_url}
                onChange={(e) =>
                  setConfig({ ...config, target_url: e.target.value })
                }
                sx={{ mb: 2 }}
              />

              {/* RPS Range */}
              <Typography variant="subtitle2" gutterBottom>
                RPS Range: {formatRPS(config.min_rps)} →{" "}
                {formatRPS(config.max_rps)}
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption">Min RPS</Typography>
                <Slider
                  value={Math.log10(config.min_rps)}
                  onChange={(_, value) =>
                    setConfig({
                      ...config,
                      min_rps: Math.pow(10, value as number),
                    })
                  }
                  min={0}
                  max={6}
                  step={0.1}
                  marks={[
                    { value: 0, label: "1" },
                    { value: 3, label: "1K" },
                    { value: 6, label: "1M" },
                  ]}
                />
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="caption">Max RPS</Typography>
                <Slider
                  value={Math.log10(config.max_rps)}
                  onChange={(_, value) =>
                    setConfig({
                      ...config,
                      max_rps: Math.pow(10, value as number),
                    })
                  }
                  min={0}
                  max={6}
                  step={0.1}
                  marks={[
                    { value: 0, label: "1" },
                    { value: 3, label: "1K" },
                    { value: 6, label: "1M" },
                  ]}
                />
              </Box>

              {/* Scale Mode */}
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Scale Mode</InputLabel>
                <Select
                  value={config.scale_mode}
                  label="Scale Mode"
                  onChange={(e) =>
                    setConfig({ ...config, scale_mode: e.target.value })
                  }
                >
                  <MenuItem value="linear">Linear</MenuItem>
                  <MenuItem value="logarithmic">Logarithmic</MenuItem>
                  <MenuItem value="exponential">Exponential</MenuItem>
                  <MenuItem value="step">Step (Powers of 10)</MenuItem>
                </Select>
              </FormControl>

              <Typography
                variant="caption"
                color="textSecondary"
                sx={{ mb: 2, display: "block" }}
              >
                {getScaleModeDescription(config.scale_mode)}
              </Typography>

              {/* Duration */}
              <TextField
                fullWidth
                type="number"
                label="Duration (minutes)"
                value={config.duration}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    duration: parseInt(e.target.value) || 1,
                  })
                }
                sx={{ mb: 2 }}
              />

              {/* Concurrent Users */}
              <TextField
                fullWidth
                type="number"
                label="Concurrent Users"
                value={config.concurrent_users}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    concurrent_users: parseInt(e.target.value) || 1,
                  })
                }
                sx={{ mb: 3 }}
              />

              {/* Control Buttons */}
              <Box sx={{ display: "flex", gap: 1 }}>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<PlayArrow />}
                  onClick={startSimulation}
                  disabled={isRunning || connectionStatus !== "connected"}
                  fullWidth
                >
                  Start Mega-Scale Test
                </Button>
                {isRunning && (
                  <Button
                    variant="contained"
                    color="error"
                    startIcon={<Stop />}
                    onClick={stopSimulation}
                    fullWidth
                  >
                    Stop Test
                  </Button>
                )}
              </Box>

              {isRunning && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" gutterBottom>
                    Test in progress...
                  </Typography>
                  <LinearProgress />
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Visualization Panel */}
        <Grid item xs={12} md={8}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Box
                sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}
              >
                <Typography variant="h6">
                  <Timeline sx={{ mr: 1 }} />
                  Real-Time Performance Visualization
                </Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={showRealTime}
                      onChange={(e) => setShowRealTime(e.target.checked)}
                    />
                  }
                  label="Real-time Updates"
                />
              </Box>

              {/* Performance Stats */}
              {timeSeriesData.length > 0 && (
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={3}>
                    <Card variant="outlined">
                      <CardContent sx={{ p: 1 }}>
                        <Typography variant="caption">Current RPS</Typography>
                        <Typography variant="h6">
                          {formatRPS(
                            timeSeriesData[timeSeriesData.length - 1]?.rps || 0
                          )}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={3}>
                    <Card variant="outlined">
                      <CardContent sx={{ p: 1 }}>
                        <Typography variant="caption">Target RPS</Typography>
                        <Typography variant="h6">
                          {formatRPS(
                            timeSeriesData[timeSeriesData.length - 1]
                              ?.target_rps || 0
                          )}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={3}>
                    <Card variant="outlined">
                      <CardContent sx={{ p: 1 }}>
                        <Typography variant="caption">
                          Avg Response Time
                        </Typography>
                        <Typography variant="h6">
                          {(
                            timeSeriesData[timeSeriesData.length - 1]
                              ?.response_time || 0
                          ).toFixed(1)}
                          ms
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={3}>
                    <Card variant="outlined">
                      <CardContent sx={{ p: 1 }}>
                        <Typography variant="caption">Error Rate</Typography>
                        <Typography variant="h6">
                          {(
                            timeSeriesData[timeSeriesData.length - 1]
                              ?.error_rate || 0
                          ).toFixed(1)}
                          %
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              )}

              {/* Chart */}
              <Box sx={{ height: 400 }}>
                {timeSeriesData.length > 0 ? (
                  <Line data={chartData} options={chartOptions} />
                ) : (
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "100%",
                      color: "text.secondary",
                    }}
                  >
                    <TrendingUp sx={{ mr: 1, fontSize: 48 }} />
                    <Typography variant="h6">
                      {isRunning
                        ? "Waiting for data..."
                        : "Start a simulation to see performance data"}
                    </Typography>
                  </Box>
                )}
              </Box>

              {/* Scale Legend */}
              <Box sx={{ mt: 2, display: "flex", gap: 1, flexWrap: "wrap" }}>
                <Chip label="1 RPS" size="small" />
                <Chip label="10 RPS" size="small" />
                <Chip label="100 RPS" size="small" />
                <Chip label="1K RPS" size="small" color="primary" />
                <Chip label="10K RPS" size="small" color="primary" />
                <Chip label="100K RPS" size="small" color="secondary" />
                <Chip label="1M RPS" size="small" color="error" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default MegaScaleSimulation;
