import React from "react";
import {
  Box,
  Typography,
  Switch,
  FormControlLabel,
  TextField,
  Button,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  InputAdornment,
  Divider,
} from "@mui/material";
import {
  Add,
  Delete,
  ExpandMore,
  CheckCircle,
  Timer,
  Http,
  Code,
} from "@mui/icons-material";
import { ValidationConfig, ValidationRule } from "../../types/SimulationConfig";

interface ValidationConfigProps {
  config: ValidationConfig;
  onChange: (config: ValidationConfig) => void;
}

const ValidationConfigComponent: React.FC<ValidationConfigProps> = ({
  config,
  onChange,
}) => {
  const updateConfig = (field: keyof ValidationConfig, value: any) => {
    onChange({ ...config, [field]: value });
  };

  const addRule = () => {
    const newRule: ValidationRule = {
      type: "status_code",
      operator: "equals",
      value: 200,
      enabled: true,
    };
    updateConfig("rules", [...config.rules, newRule]);
  };

  const updateRule = (index: number, rule: ValidationRule) => {
    const newRules = [...config.rules];
    newRules[index] = rule;
    updateConfig("rules", newRules);
  };

  const removeRule = (index: number) => {
    const newRules = config.rules.filter((_, i) => i !== index);
    updateConfig("rules", newRules);
  };

  const toggleRule = (index: number) => {
    const newRules = [...config.rules];
    newRules[index] = { ...newRules[index], enabled: !newRules[index].enabled };
    updateConfig("rules", newRules);
  };

  const addStatusCode = (code: number) => {
    if (!config.expectedStatusCodes.includes(code)) {
      updateConfig("expectedStatusCodes", [...config.expectedStatusCodes, code]);
    }
  };

  const removeStatusCode = (code: number) => {
    updateConfig(
      "expectedStatusCodes",
      config.expectedStatusCodes.filter((c) => c !== code)
    );
  };

  const validationTypes = [
    { value: "status_code", label: "Status Code", icon: <Http /> },
    { value: "response_time", label: "Response Time", icon: <Timer /> },
    { value: "body_content", label: "Body Content", icon: <Code /> },
    { value: "header", label: "Header Value", icon: <Http /> },
  ];

  const operators = [
    { value: "equals", label: "Equals" },
    { value: "not_equals", label: "Not Equals" },
    { value: "contains", label: "Contains" },
    { value: "gt", label: "Greater Than" },
    { value: "lt", label: "Less Than" },
    { value: "exists", label: "Exists" },
  ];

  const commonStatusCodes = [
    { code: 200, label: "200 OK" },
    { code: 201, label: "201 Created" },
    { code: 202, label: "202 Accepted" },
    { code: 204, label: "204 No Content" },
    { code: 400, label: "400 Bad Request" },
    { code: 401, label: "401 Unauthorized" },
    { code: 403, label: "403 Forbidden" },
    { code: 404, label: "404 Not Found" },
    { code: 500, label: "500 Internal Server Error" },
  ];

  const getOperatorOptions = (type: ValidationRule["type"]) => {
    switch (type) {
      case "status_code":
        return operators.filter((op) => ["equals", "not_equals"].includes(op.value));
      case "response_time":
        return operators.filter((op) => ["lt", "gt"].includes(op.value));
      case "body_content":
        return operators.filter((op) => ["contains", "not_equals", "equals"].includes(op.value));
      case "header":
        return operators.filter((op) => ["equals", "contains", "exists"].includes(op.value));
      default:
        return operators;
    }
  };

  const getValuePlaceholder = (rule: ValidationRule) => {
    switch (rule.type) {
      case "status_code":
        return "200";
      case "response_time":
        return "500";
      case "body_content":
        return rule.operator === "contains" ? "success" : '{"status": "ok"}';
      case "header":
        return rule.operator === "exists" ? "Content-Type" : "application/json";
      default:
        return "";
    }
  };

  const getValueType = (rule: ValidationRule) => {
    if (rule.type === "response_time" || rule.type === "status_code") {
      return "number";
    }
    return "text";
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
        Response Validation
      </Typography>

      {/* Enable/Disable Validation */}
      <FormControlLabel
        control={
          <Switch
            checked={config.enabled}
            onChange={(e) => updateConfig("enabled", e.target.checked)}
          />
        }
        label="Enable Response Validation"
        sx={{ mb: 3 }}
      />

      {config.enabled && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {/* Status Code Validation */}
          <Box>
            <Typography variant="subtitle1" gutterBottom sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Http /> Expected Status Codes
            </Typography>
            
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
              {config.expectedStatusCodes.map((code) => (
                <Chip
                  key={code}
                  label={code}
                  onDelete={() => removeStatusCode(code)}
                  color={code >= 200 && code < 300 ? "success" : "default"}
                />
              ))}
            </Box>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="body2" color="text.secondary">
                  Add Common Status Codes
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                  {commonStatusCodes.map((statusCode) => (
                    <Chip
                      key={statusCode.code}
                      label={statusCode.label}
                      onClick={() => addStatusCode(statusCode.code)}
                      size="small"
                      variant="outlined"
                      clickable
                      color={
                        config.expectedStatusCodes.includes(statusCode.code)
                          ? "primary"
                          : "default"
                      }
                    />
                  ))}
                </Box>
              </AccordionDetails>
            </Accordion>
          </Box>

          <Divider />

          {/* Response Time Validation */}
          <Box>
            <Typography variant="subtitle1" gutterBottom sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Timer /> Response Time Limits
            </Typography>
            
            <TextField
              label="Maximum Response Time"
              type="number"
              value={config.maxResponseTime || ""}
              onChange={(e) => updateConfig("maxResponseTime", parseInt(e.target.value) || undefined)}
              InputProps={{
                endAdornment: <InputAdornment position="end">ms</InputAdornment>,
              }}
              helperText="Requests slower than this will be marked as failed"
              inputProps={{ min: 1 }}
            />
          </Box>

          <Divider />

          {/* Custom Validation Rules */}
          <Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
              <Typography variant="subtitle1" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <CheckCircle /> Custom Validation Rules
              </Typography>
              <Button startIcon={<Add />} onClick={addRule} size="small" variant="outlined">
                Add Rule
              </Button>
            </Box>

            {config.rules.length === 0 && (
              <Alert severity="info">
                No custom validation rules defined. Click "Add Rule" to create validation logic for headers, body content, or custom checks.
              </Alert>
            )}

            {config.rules.map((rule, index) => (
              <Box
                key={index}
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  p: 2,
                  border: 1,
                  borderColor: rule.enabled ? "primary.main" : "grey.300",
                  borderRadius: 1,
                  mb: 2,
                  opacity: rule.enabled ? 1 : 0.6,
                }}
              >
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={rule.enabled}
                        onChange={() => toggleRule(index)}
                        size="small"
                      />
                    }
                    label={`Rule ${index + 1}`}
                  />
                  <IconButton onClick={() => removeRule(index)} size="small" color="error">
                    <Delete />
                  </IconButton>
                </Box>

                <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "flex-start" }}>
                  {/* Validation Type */}
                  <FormControl sx={{ minWidth: 150 }}>
                    <InputLabel>Validation Type</InputLabel>
                    <Select
                      value={rule.type}
                      label="Validation Type"
                      onChange={(e) =>
                        updateRule(index, {
                          ...rule,
                          type: e.target.value as ValidationRule["type"],
                        })
                      }
                      size="small"
                    >
                      {validationTypes.map((type) => (
                        <MenuItem key={type.value} value={type.value}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            {type.icon}
                            {type.label}
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {/* Field Name (for header validation) */}
                  {rule.type === "header" && (
                    <TextField
                      label="Header Name"
                      value={rule.field || ""}
                      onChange={(e) => updateRule(index, { ...rule, field: e.target.value })}
                      size="small"
                      placeholder="Content-Type"
                      sx={{ minWidth: 150 }}
                    />
                  )}

                  {/* Operator */}
                  <FormControl sx={{ minWidth: 120 }}>
                    <InputLabel>Operator</InputLabel>
                    <Select
                      value={rule.operator}
                      label="Operator"
                      onChange={(e) =>
                        updateRule(index, {
                          ...rule,
                          operator: e.target.value as ValidationRule["operator"],
                        })
                      }
                      size="small"
                    >
                      {getOperatorOptions(rule.type).map((op) => (
                        <MenuItem key={op.value} value={op.value}>
                          {op.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {/* Value */}
                  {rule.operator !== "exists" && (
                    <TextField
                      label="Expected Value"
                      value={rule.value}
                      onChange={(e) =>
                        updateRule(index, {
                          ...rule,
                          value: getValueType(rule) === "number" 
                            ? parseInt(e.target.value) || 0 
                            : e.target.value,
                        })
                      }
                      type={getValueType(rule)}
                      size="small"
                      placeholder={getValuePlaceholder(rule)}
                      sx={{ minWidth: 150 }}
                      InputProps={{
                        endAdornment: rule.type === "response_time" && (
                          <InputAdornment position="end">ms</InputAdornment>
                        ),
                      }}
                    />
                  )}
                </Box>

                {/* Rule Description */}
                <Alert severity="info" sx={{ mt: 1 }}>
                  <Typography variant="body2">
                    {rule.type === "status_code" && `Response status code ${rule.operator} ${rule.value}`}
                    {rule.type === "response_time" && `Response time ${rule.operator} ${rule.value}ms`}
                    {rule.type === "body_content" && `Response body ${rule.operator} "${rule.value}"`}
                    {rule.type === "header" && rule.operator === "exists" && `Header "${rule.field}" exists`}
                    {rule.type === "header" && rule.operator !== "exists" && `Header "${rule.field}" ${rule.operator} "${rule.value}"`}
                  </Typography>
                </Alert>
              </Box>
            ))}
          </Box>

          {/* Validation Summary */}
          <Alert severity={config.enabled ? "success" : "info"}>
            <Typography variant="body2">
              <strong>Validation Summary:</strong>{" "}
              {config.enabled ? (
                <>
                  Expecting status codes: {config.expectedStatusCodes.join(", ")}
                  {config.maxResponseTime && `, response time < ${config.maxResponseTime}ms`}
                  {config.rules.filter(r => r.enabled).length > 0 && `, ${config.rules.filter(r => r.enabled).length} custom rule(s)`}
                </>
              ) : (
                "Validation is disabled. Only basic request/response metrics will be collected."
              )}
            </Typography>
          </Alert>

          {/* Validation Tips */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="body2" color="text.secondary">
                💡 Validation Tips & Best Practices
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <Typography variant="body2">
                  • <strong>Status Codes:</strong> Include expected error codes (404, 400) for comprehensive testing
                </Typography>
                <Typography variant="body2">
                  • <strong>Response Time:</strong> Set realistic limits based on your SLA requirements
                </Typography>
                <Typography variant="body2">
                  • <strong>Body Content:</strong> Use "contains" for partial matches, "equals" for exact matches
                </Typography>
                <Typography variant="body2">
                  • <strong>Headers:</strong> Validate important headers like Content-Type, Cache-Control
                </Typography>
                <Typography variant="body2">
                  • <strong>Performance:</strong> Too many validation rules can slow down the test execution
                </Typography>
              </Box>
            </AccordionDetails>
          </Accordion>
        </Box>
      )}
    </Box>
  );
};

export default ValidationConfigComponent;
