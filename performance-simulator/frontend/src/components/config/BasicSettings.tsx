import React from "react";
import {
  Box,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Typography,
  Chip,
  InputAdornment,
  IconButton,
  Tooltip,
} from "@mui/material";
import { Help, Link as LinkIcon } from "@mui/icons-material";
import {
  SimulationConfigForm,
  HttpMethod,
  FormErrors,
  FormTouched,
} from "../../types/SimulationConfig";

interface BasicSettingsProps {
  config: SimulationConfigForm;
  errors: FormErrors;
  touched: FormTouched;
  onChange: (field: keyof SimulationConfigForm, value: any) => void;
  onBlur: (field: keyof SimulationConfigForm) => void;
}

const HTTP_METHODS: { value: HttpMethod; label: string; color: string }[] = [
  { value: "GET", label: "GET", color: "#4CAF50" },
  { value: "POST", label: "POST", color: "#FF9800" },
  { value: "PUT", label: "PUT", color: "#2196F3" },
  { value: "DELETE", label: "DELETE", color: "#F44336" },
  { value: "PATCH", label: "PATCH", color: "#9C27B0" },
  { value: "HEAD", label: "HEAD", color: "#607D8B" },
  { value: "OPTIONS", label: "OPTIONS", color: "#795548" },
];

const BasicSettings: React.FC<BasicSettingsProps> = ({
  config,
  errors,
  touched,
  onChange,
  onBlur,
}) => {
  const validateUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const getMethodColor = (method: HttpMethod): string => {
    return HTTP_METHODS.find((m) => m.value === method)?.color || "#666";
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
        Basic Configuration
      </Typography>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {/* Test Name */}
        <TextField
          fullWidth
          label="Test Name"
          value={config.name}
          onChange={(e) => onChange("name", e.target.value)}
          onBlur={() => onBlur("name")}
          error={touched.name && !!errors.name}
          helperText={touched.name && errors.name}
          placeholder="e.g., User API Load Test"
          required
        />

        {/* Description */}
        <TextField
          fullWidth
          label="Description"
          value={config.description || ""}
          onChange={(e) => onChange("description", e.target.value)}
          onBlur={() => onBlur("description")}
          multiline
          rows={2}
          placeholder="Optional description of what this test validates..."
        />

        {/* Target URL and Method */}
        <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
          {/* HTTP Method */}
          <FormControl sx={{ minWidth: 120 }}>
            <InputLabel id="method-select-label">Method</InputLabel>
            <Select
              labelId="method-select-label"
              value={config.method}
              label="Method"
              onChange={(e) => onChange("method", e.target.value as HttpMethod)}
              onBlur={() => onBlur("method")}
              renderValue={(selected) => (
                <Chip
                  label={selected}
                  size="small"
                  sx={{
                    backgroundColor: getMethodColor(selected),
                    color: "white",
                    fontWeight: "bold",
                  }}
                />
              )}
            >
              {HTTP_METHODS.map((method) => (
                <MenuItem key={method.value} value={method.value}>
                  <Chip
                    label={method.label}
                    size="small"
                    sx={{
                      backgroundColor: method.color,
                      color: "white",
                      fontWeight: "bold",
                      mr: 1,
                    }}
                  />
                  {method.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Target URL */}
          <TextField
            fullWidth
            label="Target URL"
            value={config.targetUrl}
            onChange={(e) => onChange("targetUrl", e.target.value)}
            onBlur={() => onBlur("targetUrl")}
            error={touched.targetUrl && !!errors.targetUrl}
            helperText={
              touched.targetUrl && errors.targetUrl
                ? errors.targetUrl
                : "Full URL including protocol (https://api.example.com/users)"
            }
            placeholder="https://api.example.com/users"
            required
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LinkIcon color="action" />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  {config.targetUrl && validateUrl(config.targetUrl) && (
                    <Chip label="Valid URL" size="small" color="success" />
                  )}
                </InputAdornment>
              ),
            }}
          />
        </Box>

        {/* Timeout Setting */}
        <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
          <TextField
            label="Request Timeout"
            type="number"
            value={config.timeout}
            onChange={(e) => onChange("timeout", parseInt(e.target.value) || 30)}
            onBlur={() => onBlur("timeout")}
            error={touched.timeout && !!errors.timeout}
            helperText={touched.timeout && errors.timeout}
            InputProps={{
              endAdornment: <InputAdornment position="end">seconds</InputAdornment>,
            }}
            sx={{ width: 200 }}
            inputProps={{
              min: 1,
              max: 300,
            }}
          />
          <Tooltip title="Maximum time to wait for each request response. Requests exceeding this will be marked as timeouts.">
            <IconButton size="small">
              <Help fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        {/* URL Validation Status */}
        {config.targetUrl && (
          <Box sx={{ mt: 2 }}>
            {validateUrl(config.targetUrl) ? (
              <Typography variant="body2" color="success.main" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                ✓ Valid URL format
              </Typography>
            ) : (
              <Typography variant="body2" color="error.main" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                ✗ Invalid URL format - must include protocol (http:// or https://)
              </Typography>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default BasicSettings;
