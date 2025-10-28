import React from "react";
import {
  Box,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Card,
  CardContent,
  Alert,
  Chip,
  InputAdornment,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import {
  ExpandMore,
  TrendingUp,
  Speed,
  Timer,
  People,
} from "@mui/icons-material";
import { Line } from "react-chartjs-2";
import {
  LoadConfig,
  LoadPattern,
  ScaleMode,
  LOAD_PATTERN_DESCRIPTIONS,
  SCALE_MODE_DESCRIPTIONS,
} from "../../types/SimulationConfig";

interface LoadConfigProps {
  config: LoadConfig;
  onChange: (config: LoadConfig) => void;
}

const LoadConfigComponent: React.FC<LoadConfigProps> = ({
  config,
  onChange,
}) => {
  const updateConfig = (field: keyof LoadConfig, value: any) => {
    onChange({ ...config, [field]: value });
  };

  const formatRPS = (rps: number): string => {
    if (rps >= 1000000) return `${(rps / 1000000).toFixed(1)}M`;
    if (rps >= 1000) return `${(rps / 1000).toFixed(1)}K`;
    return rps.toString();
  };

  const formatDuration = (minutes: number): string => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0
        ? `${hours}h ${remainingMinutes}m`
        : `${hours}h`;
    }
    return `${minutes}m`;
  };

  // Generate preview data for the load pattern chart
  const generatePreviewData = () => {
    const points = 50;
    const labels = [];
    const data = [];

    for (let i = 0; i <= points; i++) {
      const progress = i / points;
      const timeLabel = Math.round((progress * config.duration * 60) / 10) * 10; // in seconds
      labels.push(`${timeLabel}s`);

      let rps = config.minRps;
      switch (config.pattern) {
        case "constant":
          rps = config.maxRps;
          break;
        case "linear_ramp":
          rps = config.minRps + (config.maxRps - config.minRps) * progress;
          break;
        case "exponential":
          rps =
            config.minRps +
            (config.maxRps - config.minRps) * Math.pow(progress, 2);
          break;
        case "logarithmic":
          rps =
            progress === 0
              ? config.minRps
              : config.minRps +
                (config.maxRps - config.minRps) * Math.log10(1 + 9 * progress);
          break;
        case "spike":
          const midpoint = 0.5;
          const spikeWidth = 0.1;
          if (
            progress >= midpoint - spikeWidth &&
            progress <= midpoint + spikeWidth
          ) {
            rps = config.maxRps;
          } else {
            rps = config.maxRps * 0.1;
          }
          break;
        case "sine_wave":
          const cycles = 3;
          const sineValue = Math.sin(2 * Math.PI * cycles * progress);
          const amplitude = (config.maxRps - config.minRps) / 2;
          const baseline = config.minRps + amplitude;
          rps = baseline + amplitude * sineValue;
          break;
        case "step_ramp":
          const stepProgress = Math.floor(progress * 10) / 10;
          rps = config.minRps + (config.maxRps - config.minRps) * stepProgress;
          break;
        case "mega_scale":
          // Apply scale mode for mega scale
          switch (config.scaleMode) {
            case "linear":
              rps = config.minRps + (config.maxRps - config.minRps) * progress;
              break;
            case "logarithmic":
              rps =
                progress === 0
                  ? config.minRps
                  : config.minRps +
                    (config.maxRps - config.minRps) *
                      Math.log10(1 + 9 * progress);
              break;
            case "exponential":
              rps =
                config.minRps +
                (config.maxRps - config.minRps) * Math.pow(progress, 3);
              break;
            case "step":
              const steps = [1, 10, 100, 1000, 10000, 100000, 1000000];
              const stepIndex = Math.floor(progress * (steps.length - 1));
              const target = steps[stepIndex] || steps[steps.length - 1];
              rps = Math.min(target, config.maxRps);
              break;
          }
          break;
        default:
          rps = config.maxRps;
      }
      data.push(Math.max(rps, config.minRps));
    }

    return { labels, data };
  };

  const chartData = generatePreviewData();
  const previewChart = {
    labels: chartData.labels.filter((_, i) => i % 5 === 0), // Show every 5th label
    datasets: [
      {
        label: "Target RPS",
        data: chartData.data.filter((_, i) => i % 5 === 0),
        borderColor: "rgba(33, 150, 243, 1)",
        backgroundColor: "rgba(33, 150, 243, 0.1)",
        borderWidth: 2,
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: `${config.pattern.replace("_", " ").toUpperCase()} Pattern Preview`,
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: "Time",
        },
      },
      y: {
        type: config.maxRps > 10000 ? "logarithmic" : "linear",
        title: {
          display: true,
          text: "Requests per Second (RPS)",
        },
        ticks: {
          callback: function (value: any) {
            return formatRPS(Number(value));
          },
        },
      },
    },
  };

  const loadPatterns: {
    value: LoadPattern;
    label: string;
    icon: React.ReactNode;
  }[] = [
    { value: "constant", label: "Constant Load", icon: <Speed /> },
    { value: "linear_ramp", label: "Linear Ramp", icon: <TrendingUp /> },
    { value: "exponential", label: "Exponential Growth", icon: <TrendingUp /> },
    { value: "logarithmic", label: "Logarithmic Growth", icon: <TrendingUp /> },
    { value: "spike", label: "Spike Test", icon: <TrendingUp /> },
    { value: "sine_wave", label: "Sine Wave", icon: <TrendingUp /> },
    { value: "step_ramp", label: "Step Ramp", icon: <TrendingUp /> },
    { value: "mega_scale", label: "Mega Scale", icon: <TrendingUp /> },
  ];

  const scaleModes: { value: ScaleMode; label: string }[] = [
    { value: "linear", label: "Linear" },
    { value: "logarithmic", label: "Logarithmic" },
    { value: "exponential", label: "Exponential" },
    { value: "step", label: "Step (Powers of 10)" },
  ];

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
        Load Configuration
      </Typography>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {/* Load Pattern Selection */}
        <Card variant="outlined">
          <CardContent>
            <Typography
              variant="subtitle1"
              gutterBottom
              sx={{ display: "flex", alignItems: "center", gap: 1 }}
            >
              <TrendingUp /> Load Pattern
            </Typography>

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Load Pattern</InputLabel>
              <Select
                value={config.pattern}
                label="Load Pattern"
                onChange={(e) =>
                  updateConfig("pattern", e.target.value as LoadPattern)
                }
              >
                {loadPatterns.map((pattern) => (
                  <MenuItem key={pattern.value} value={pattern.value}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      {pattern.icon}
                      {pattern.label}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Alert severity="info" sx={{ mb: 2 }}>
              {LOAD_PATTERN_DESCRIPTIONS[config.pattern]}
            </Alert>

            {/* Scale Mode (for mega_scale pattern) */}
            {config.pattern === "mega_scale" && (
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Scale Mode</InputLabel>
                <Select
                  value={config.scaleMode}
                  label="Scale Mode"
                  onChange={(e) =>
                    updateConfig("scaleMode", e.target.value as ScaleMode)
                  }
                >
                  {scaleModes.map((mode) => (
                    <MenuItem key={mode.value} value={mode.value}>
                      {mode.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {config.pattern === "mega_scale" && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                <strong>Mega Scale Mode:</strong>{" "}
                {SCALE_MODE_DESCRIPTIONS[config.scaleMode]}
              </Alert>
            )}

            {/* Load Pattern Preview Chart */}
            <Box sx={{ height: 200, mt: 2 }}>
              <Line data={previewChart} options={chartOptions} />
            </Box>
          </CardContent>
        </Card>

        {/* RPS Configuration */}
        <Card variant="outlined">
          <CardContent>
            <Typography
              variant="subtitle1"
              gutterBottom
              sx={{ display: "flex", alignItems: "center", gap: 1 }}
            >
              <Speed /> Request Rate Configuration
            </Typography>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {/* RPS Range Display */}
              <Box sx={{ textAlign: "center" }}>
                <Typography variant="h6" color="primary">
                  {formatRPS(config.minRps)} → {formatRPS(config.maxRps)} RPS
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Target load range
                </Typography>
              </Box>

              {/* Min RPS Slider */}
              <Box>
                <Typography variant="body2" gutterBottom>
                  Minimum RPS: {formatRPS(config.minRps)}
                </Typography>
                <Slider
                  value={Math.log10(Math.max(config.minRps, 1))}
                  onChange={(_, value) =>
                    updateConfig(
                      "minRps",
                      Math.round(Math.pow(10, value as number))
                    )
                  }
                  min={0} // 10^0 = 1
                  max={7} // 10^7 = 10,000,000
                  step={0.1}
                  marks={[
                    { value: 0, label: "1" },
                    { value: 1, label: "10" },
                    { value: 2, label: "100" },
                    { value: 3, label: "1K" },
                    { value: 4, label: "10K" },
                    { value: 5, label: "100K" },
                    { value: 6, label: "1M" },
                    { value: 7, label: "10M" },
                  ]}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(value) => formatRPS(Math.pow(10, value))}
                />
              </Box>

              {/* Max RPS Slider */}
              <Box>
                <Typography variant="body2" gutterBottom>
                  Maximum RPS: {formatRPS(config.maxRps)}
                </Typography>
                <Slider
                  value={Math.log10(Math.max(config.maxRps, 1))}
                  onChange={(_, value) =>
                    updateConfig(
                      "maxRps",
                      Math.round(Math.pow(10, value as number))
                    )
                  }
                  min={0} // 10^0 = 1
                  max={7} // 10^7 = 10,000,000
                  step={0.1}
                  marks={[
                    { value: 0, label: "1" },
                    { value: 1, label: "10" },
                    { value: 2, label: "100" },
                    { value: 3, label: "1K" },
                    { value: 4, label: "10K" },
                    { value: 5, label: "100K" },
                    { value: 6, label: "1M" },
                    { value: 7, label: "10M" },
                  ]}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(value) => formatRPS(Math.pow(10, value))}
                />
              </Box>

              {/* Warning for high RPS */}
              {config.maxRps > 100000 && (
                <Alert severity="warning">
                  <strong>High Load Warning:</strong> Testing at{" "}
                  {formatRPS(config.maxRps)} RPS may require significant system
                  resources and could impact the target service.
                </Alert>
              )}
            </Box>
          </CardContent>
        </Card>

        {/* Timing Configuration */}
        <Card variant="outlined">
          <CardContent>
            <Typography
              variant="subtitle1"
              gutterBottom
              sx={{ display: "flex", alignItems: "center", gap: 1 }}
            >
              <Timer /> Timing Configuration
            </Typography>

            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
              <TextField
                label="Test Duration"
                type="number"
                value={config.duration}
                onChange={(e) =>
                  updateConfig("duration", parseInt(e.target.value) || 1)
                }
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">minutes</InputAdornment>
                  ),
                }}
                inputProps={{ min: 1, max: 1440 }}
                helperText={`Total test time: ${formatDuration(config.duration)}`}
              />

              {(config.pattern === "linear_ramp" ||
                config.pattern === "exponential") && (
                <TextField
                  label="Ramp-up Time"
                  type="number"
                  value={config.rampUpTime}
                  onChange={(e) =>
                    updateConfig("rampUpTime", parseInt(e.target.value) || 60)
                  }
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">seconds</InputAdornment>
                    ),
                  }}
                  inputProps={{ min: 1, max: config.duration * 60 }}
                  helperText="Time to reach maximum RPS"
                />
              )}
            </Box>
          </CardContent>
        </Card>

        {/* Concurrency Configuration */}
        <Card variant="outlined">
          <CardContent>
            <Typography
              variant="subtitle1"
              gutterBottom
              sx={{ display: "flex", alignItems: "center", gap: 1 }}
            >
              <People /> Concurrency Configuration
            </Typography>

            <TextField
              label="Concurrent Users"
              type="number"
              value={config.concurrentUsers}
              onChange={(e) =>
                updateConfig("concurrentUsers", parseInt(e.target.value) || 1)
              }
              fullWidth
              inputProps={{ min: 1, max: 50000 }}
              helperText="Number of virtual users making concurrent requests"
            />

            {/* Concurrency Recommendations */}
            <Accordion sx={{ mt: 2 }}>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="body2" color="text.secondary">
                  Concurrency Recommendations
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  <Typography variant="body2">
                    <Chip
                      label="Light Load"
                      size="small"
                      color="success"
                      sx={{ mr: 1 }}
                    />
                    1-50 users for basic functionality testing
                  </Typography>
                  <Typography variant="body2">
                    <Chip
                      label="Medium Load"
                      size="small"
                      color="warning"
                      sx={{ mr: 1 }}
                    />
                    50-500 users for performance testing
                  </Typography>
                  <Typography variant="body2">
                    <Chip
                      label="Heavy Load"
                      size="small"
                      color="error"
                      sx={{ mr: 1 }}
                    />
                    500+ users for stress testing
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mt: 1 }}
                  >
                    Higher concurrency increases memory usage. Start with lower
                    values and increase gradually.
                  </Typography>
                </Box>
              </AccordionDetails>
            </Accordion>
          </CardContent>
        </Card>

        {/* Load Summary */}
        <Alert severity="success">
          <Typography variant="body2">
            <strong>Load Summary:</strong> {config.concurrentUsers} concurrent
            users will generate {formatRPS(config.minRps)} to{" "}
            {formatRPS(config.maxRps)} requests per second using a{" "}
            {config.pattern.replace("_", " ")} pattern for{" "}
            {formatDuration(config.duration)}.
          </Typography>
        </Alert>
      </Box>
    </Box>
  );
};

export default LoadConfigComponent;
