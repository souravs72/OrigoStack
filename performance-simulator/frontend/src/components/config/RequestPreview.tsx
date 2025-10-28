import React, { useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Tabs,
  Tab,
  Button,
  Chip,
  Alert,
  Divider,
  IconButton,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import {
  ContentCopy,
  Code,
  Http,
  Security,
  CheckCircle,
  ExpandMore,
  Refresh,
} from "@mui/icons-material";
import { CompleteSimulationConfig } from "../../types/SimulationConfig";

interface RequestPreviewProps {
  config: CompleteSimulationConfig;
  onTestConnection?: () => void;
  testingConnection?: boolean;
  connectionResult?: {
    success: boolean;
    statusCode?: number;
    responseTime?: string;
    error?: string;
  } | null;
}

interface TabPanelProps {
  children?: React.ReactNode;
  value: number;
  index: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div hidden={value !== index} style={{ marginTop: 16 }}>
      {value === index && children}
    </div>
  );
};

const RequestPreview: React.FC<RequestPreviewProps> = ({
  config,
  onTestConnection,
  testingConnection = false,
  connectionResult,
}) => {
  const [tabValue, setTabValue] = useState(0);

  // Build the complete URL with query parameters
  const buildCompleteUrl = (): string => {
    try {
      const url = new URL(config.targetUrl);
      Object.entries(config.request.queryParams).forEach(([key, value]) => {
        if (key && value) {
          url.searchParams.set(key, value);
        }
      });
      return url.toString();
    } catch (error) {
      return config.targetUrl;
    }
  };

  // Build headers including auth headers
  const buildHeaders = (): Record<string, string> => {
    const headers = { ...config.request.headers };

    // Add Content-Type based on body type
    if (config.request.body.type !== "none") {
      switch (config.request.body.type) {
        case "json":
          headers["Content-Type"] = "application/json";
          break;
        case "form":
          headers["Content-Type"] = "application/x-www-form-urlencoded";
          break;
        case "xml":
          headers["Content-Type"] = "application/xml";
          break;
        case "raw":
          if (config.request.body.contentType) {
            headers["Content-Type"] = config.request.body.contentType;
          }
          break;
        case "multipart":
          // Content-Type will be set by the browser with boundary
          break;
      }
    }

    // Add authentication headers
    switch (config.auth.type) {
      case "bearer":
        if (config.auth.token) {
          headers["Authorization"] = `Bearer ${config.auth.token}`;
        }
        break;
      case "basic":
        if (config.auth.username && config.auth.password) {
          const credentials = btoa(`${config.auth.username}:${config.auth.password}`);
          headers["Authorization"] = `Basic ${credentials}`;
        }
        break;
      case "apikey":
        if (config.auth.apiKey?.location === "header" && config.auth.apiKey.key) {
          headers[config.auth.apiKey.key] = config.auth.apiKey.value || "";
        }
        break;
      case "custom":
        if (config.auth.customHeaders) {
          Object.assign(headers, config.auth.customHeaders);
        }
        break;
    }

    return headers;
  };

  // Generate curl command
  const generateCurlCommand = (): string => {
    const url = buildCompleteUrl();
    const headers = buildHeaders();
    
    let curl = `curl -X ${config.method}`;
    
    // Add headers
    Object.entries(headers).forEach(([key, value]) => {
      curl += ` \\\n  -H "${key}: ${value}"`;
    });

    // Add body if present
    if (config.request.body.type !== "none" && config.request.body.content) {
      if (config.request.body.type === "json") {
        curl += ` \\\n  -d '${config.request.body.content}'`;
      } else {
        curl += ` \\\n  -d "${config.request.body.content}"`;
      }
    }

    curl += ` \\\n  "${url}"`;
    
    return curl;
  };

  // Generate raw HTTP request
  const generateRawHttp = (): string => {
    const url = new URL(buildCompleteUrl());
    const headers = buildHeaders();
    
    let http = `${config.method} ${url.pathname}${url.search} HTTP/1.1\n`;
    http += `Host: ${url.host}\n`;
    
    Object.entries(headers).forEach(([key, value]) => {
      http += `${key}: ${value}\n`;
    });

    if (config.request.body.type !== "none" && config.request.body.content) {
      http += `Content-Length: ${new Blob([config.request.body.content]).size}\n`;
      http += "\n";
      http += config.request.body.content;
    }

    return http;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getMethodColor = (method: string): string => {
    const colors: Record<string, string> = {
      GET: "#4CAF50",
      POST: "#FF9800",
      PUT: "#2196F3",
      DELETE: "#F44336",
      PATCH: "#9C27B0",
      HEAD: "#607D8B",
      OPTIONS: "#795548",
    };
    return colors[method] || "#666";
  };

  const validateConfig = (): { isValid: boolean; errors: string[]; warnings: string[] } => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!config.name.trim()) errors.push("Test name is required");
    if (!config.targetUrl.trim()) errors.push("Target URL is required");
    
    // Validate URL
    try {
      new URL(config.targetUrl);
    } catch {
      errors.push("Invalid URL format");
    }

    // Check auth configuration
    if (config.auth.type === "bearer" && !config.auth.token) {
      errors.push("Bearer token is required");
    }
    if (config.auth.type === "basic" && (!config.auth.username || !config.auth.password)) {
      errors.push("Username and password are required for basic auth");
    }
    if (config.auth.type === "apikey" && (!config.auth.apiKey?.key || !config.auth.apiKey?.value)) {
      errors.push("API key name and value are required");
    }

    // Check body configuration
    if (["POST", "PUT", "PATCH"].includes(config.method) && config.request.body.type === "none") {
      warnings.push(`${config.method} requests typically include a request body`);
    }

    // Check load configuration
    if (config.load.maxRps > 100000) {
      warnings.push("Very high RPS may impact system resources");
    }
    if (config.load.concurrentUsers > 1000) {
      warnings.push("High concurrency may require significant memory");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  };

  const validation = validateConfig();

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
        Request Preview & Testing
      </Typography>

      {/* Configuration Validation */}
      <Box sx={{ mb: 3 }}>
        {validation.errors.length > 0 && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="body2" gutterBottom>
              <strong>Configuration Errors:</strong>
            </Typography>
            {validation.errors.map((error, index) => (
              <Typography key={index} variant="body2">
                • {error}
              </Typography>
            ))}
          </Alert>
        )}

        {validation.warnings.length > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2" gutterBottom>
              <strong>Configuration Warnings:</strong>
            </Typography>
            {validation.warnings.map((warning, index) => (
              <Typography key={index} variant="body2">
                • {warning}
              </Typography>
            ))}
          </Alert>
        )}

        {validation.isValid && (
          <Alert severity="success" sx={{ mb: 2 }}>
            <CheckCircle sx={{ mr: 1 }} />
            Configuration is valid and ready for testing
          </Alert>
        )}
      </Box>

      {/* Test Connection */}
      {onTestConnection && (
        <Box sx={{ mb: 3 }}>
          <Button
            variant="outlined"
            startIcon={testingConnection ? <Refresh /> : <Http />}
            onClick={onTestConnection}
            disabled={!validation.isValid || testingConnection}
            sx={{ mb: 2 }}
          >
            {testingConnection ? "Testing Connection..." : "Test Connection"}
          </Button>

          {connectionResult && (
            <Alert
              severity={connectionResult.success ? "success" : "error"}
              sx={{ mb: 2 }}
            >
              {connectionResult.success ? (
                <Box>
                  <Typography variant="body2">
                    ✓ Connection successful! Status: {connectionResult.statusCode}
                  </Typography>
                  {connectionResult.responseTime && (
                    <Typography variant="body2">
                      Response time: {connectionResult.responseTime}
                    </Typography>
                  )}
                </Box>
              ) : (
                <Box>
                  <Typography variant="body2">✗ Connection failed</Typography>
                  {connectionResult.error && (
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Error: {connectionResult.error}
                    </Typography>
                  )}
                </Box>
              )}
            </Alert>
          )}
        </Box>
      )}

      {/* Request Preview */}
      <Card>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Code /> Request Details
          </Typography>

          {/* Request Summary */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2, flexWrap: "wrap" }}>
            <Chip
              label={config.method}
              sx={{
                backgroundColor: getMethodColor(config.method),
                color: "white",
                fontWeight: "bold",
              }}
            />
            <Typography variant="body1" sx={{ wordBreak: "break-all", flex: 1 }}>
              {buildCompleteUrl()}
            </Typography>
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Tabs for different views */}
          <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
            <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
              <Tab label="Headers" />
              <Tab label="Body" />
              <Tab label="cURL" />
              <Tab label="Raw HTTP" />
            </Tabs>
          </Box>

          {/* Headers Tab */}
          <TabPanel value={tabValue} index={0}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {Object.entries(buildHeaders()).map(([key, value]) => (
                <Box
                  key={key}
                  sx={{
                    display: "flex",
                    p: 1,
                    backgroundColor: "grey.50",
                    borderRadius: 1,
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: "bold", minWidth: 150, color: "primary.main" }}
                  >
                    {key}:
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ 
                      wordBreak: "break-all",
                      fontFamily: "monospace",
                      color: key.toLowerCase().includes("authorization") ? "text.secondary" : "text.primary"
                    }}
                  >
                    {key.toLowerCase().includes("authorization") ? "••••••••" : value}
                  </Typography>
                </Box>
              ))}
              {Object.keys(buildHeaders()).length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No headers configured
                </Typography>
              )}
            </Box>
          </TabPanel>

          {/* Body Tab */}
          <TabPanel value={tabValue} index={1}>
            <Box>
              {config.request.body.type === "none" ? (
                <Typography variant="body2" color="text.secondary">
                  No request body
                </Typography>
              ) : (
                <Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                    <Chip
                      label={config.request.body.type.toUpperCase()}
                      size="small"
                      variant="outlined"
                    />
                    <Typography variant="body2" color="text.secondary">
                      Content-Type: {buildHeaders()["Content-Type"] || "Not set"}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      p: 2,
                      backgroundColor: "grey.50",
                      borderRadius: 1,
                      fontFamily: "monospace",
                      fontSize: "0.875rem",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                      maxHeight: 300,
                      overflow: "auto",
                    }}
                  >
                    {config.request.body.content || "(empty body)"}
                  </Box>
                </Box>
              )}
            </Box>
          </TabPanel>

          {/* cURL Tab */}
          <TabPanel value={tabValue} index={2}>
            <Box>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Copy this command to test the request manually:
                </Typography>
                <Tooltip title="Copy to clipboard">
                  <IconButton
                    size="small"
                    onClick={() => copyToClipboard(generateCurlCommand())}
                  >
                    <ContentCopy />
                  </IconButton>
                </Tooltip>
              </Box>
              <Box
                sx={{
                  p: 2,
                  backgroundColor: "grey.900",
                  color: "grey.100",
                  borderRadius: 1,
                  fontFamily: "monospace",
                  fontSize: "0.875rem",
                  whiteSpace: "pre-wrap",
                  overflow: "auto",
                  maxHeight: 400,
                }}
              >
                {generateCurlCommand()}
              </Box>
            </Box>
          </TabPanel>

          {/* Raw HTTP Tab */}
          <TabPanel value={tabValue} index={3}>
            <Box>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Raw HTTP request format:
                </Typography>
                <Tooltip title="Copy to clipboard">
                  <IconButton
                    size="small"
                    onClick={() => copyToClipboard(generateRawHttp())}
                  >
                    <ContentCopy />
                  </IconButton>
                </Tooltip>
              </Box>
              <Box
                sx={{
                  p: 2,
                  backgroundColor: "grey.50",
                  borderRadius: 1,
                  fontFamily: "monospace",
                  fontSize: "0.875rem",
                  whiteSpace: "pre-wrap",
                  overflow: "auto",
                  maxHeight: 400,
                  border: 1,
                  borderColor: "grey.300",
                }}
              >
                {generateRawHttp()}
              </Box>
            </Box>
          </TabPanel>
        </CardContent>
      </Card>

      {/* Security Notice */}
      <Accordion sx={{ mt: 2 }}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="body2" color="text.secondary">
            <Security sx={{ mr: 1, verticalAlign: "middle" }} fontSize="small" />
            Security & Privacy Notice
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Alert severity="info">
            <Typography variant="body2">
              • Authentication tokens and passwords are masked in the preview for security
            </Typography>
            <Typography variant="body2">
              • Use test credentials that don't access production data
            </Typography>
            <Typography variant="body2">
              • The cURL command contains actual credentials - handle with care
            </Typography>
          </Alert>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};

export default RequestPreview;
