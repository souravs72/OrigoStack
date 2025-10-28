import React, { useState } from "react";
import {
  Box,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  Button,
  IconButton,
  InputAdornment,
} from "@mui/material";
import {
  ExpandMore,
  Visibility,
  VisibilityOff,
  Security,
  Key,
  VpnKey,
  Person,
  Science,
} from "@mui/icons-material";
import { AuthConfig, AuthType } from "../../types/SimulationConfig";

interface AuthConfigProps {
  config: AuthConfig;
  onChange: (config: AuthConfig) => void;
  onTestAuth?: () => void;
  testingAuth?: boolean;
  testResult?: {
    success: boolean;
    error?: string;
    statusCode?: number;
  };
}

interface TabPanelProps {
  children?: React.ReactNode;
  value: AuthType;
  index: AuthType;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div hidden={value !== index} style={{ marginTop: 16 }}>
      {value === index && children}
    </div>
  );
};

const AuthConfigComponent: React.FC<AuthConfigProps> = ({
  config,
  onChange,
  onTestAuth,
  testingAuth = false,
  testResult,
}) => {
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  const togglePasswordVisibility = (field: string) => {
    setShowPasswords((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const updateConfig = (field: keyof AuthConfig, value: any) => {
    onChange({ ...config, [field]: value });
  };

  const authTypes: { value: AuthType; label: string; icon: React.ReactNode; description: string }[] = [
    {
      value: "none",
      label: "No Authentication",
      icon: <Security />,
      description: "No authentication required",
    },
    {
      value: "bearer",
      label: "Bearer Token",
      icon: <VpnKey />,
      description: "Authorization: Bearer <token>",
    },
    {
      value: "basic",
      label: "Basic Auth",
      icon: <Person />,
      description: "Username and password authentication",
    },
    {
      value: "apikey",
      label: "API Key",
      icon: <Key />,
      description: "API key in header or query parameter",
    },
    {
      value: "custom",
      label: "Custom Headers",
      icon: <Security />,
      description: "Custom authentication headers",
    },
  ];

  const getAuthTypeInfo = (type: AuthType) => {
    return authTypes.find((auth) => auth.value === type);
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
        Authentication Configuration
      </Typography>

      {/* Auth Type Selection */}
      <FormControl fullWidth sx={{ mb: 3 }}>
        <InputLabel>Authentication Type</InputLabel>
        <Select
          value={config.type}
          label="Authentication Type"
          onChange={(e) => updateConfig("type", e.target.value as AuthType)}
          renderValue={(selected) => {
            const authInfo = getAuthTypeInfo(selected);
            return (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                {authInfo?.icon}
                {authInfo?.label}
              </Box>
            );
          }}
        >
          {authTypes.map((auth) => (
            <MenuItem key={auth.value} value={auth.value}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}>
                {auth.icon}
                <Box>
                  <Typography variant="body1">{auth.label}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {auth.description}
                  </Typography>
                </Box>
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Authentication Configuration Based on Type */}
      {config.type !== "none" && (
        <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 2, mb: 2 }}>
          {/* Bearer Token */}
          <TabPanel value={config.type} index="bearer">
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Typography variant="subtitle1" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <VpnKey /> Bearer Token Authentication
              </Typography>
              <Alert severity="info">
                The token will be sent as: <code>Authorization: Bearer {"<token>"}</code>
              </Alert>
              <TextField
                fullWidth
                label="Bearer Token"
                value={config.token || ""}
                onChange={(e) => updateConfig("token", e.target.value)}
                type={showPasswords.token ? "text" : "password"}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => togglePasswordVisibility("token")}>
                        {showPasswords.token ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                helperText="Paste your bearer token here. It will be sent with every request."
              />
            </Box>
          </TabPanel>

          {/* Basic Authentication */}
          <TabPanel value={config.type} index="basic">
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Typography variant="subtitle1" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Person /> Basic Authentication
              </Typography>
              <Alert severity="info">
                Username and password will be base64 encoded and sent as:{" "}
                <code>Authorization: Basic {"<encoded>"}</code>
              </Alert>
              <TextField
                fullWidth
                label="Username"
                value={config.username || ""}
                onChange={(e) => updateConfig("username", e.target.value)}
                placeholder="your-username"
              />
              <TextField
                fullWidth
                label="Password"
                value={config.password || ""}
                onChange={(e) => updateConfig("password", e.target.value)}
                type={showPasswords.password ? "text" : "password"}
                placeholder="your-password"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => togglePasswordVisibility("password")}>
                        {showPasswords.password ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
          </TabPanel>

          {/* API Key */}
          <TabPanel value={config.type} index="apikey">
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Typography variant="subtitle1" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Key /> API Key Authentication
              </Typography>
              <Box sx={{ display: "flex", gap: 2 }}>
                <TextField
                  label="API Key Name"
                  value={config.apiKey?.key || ""}
                  onChange={(e) =>
                    updateConfig("apiKey", {
                      ...config.apiKey,
                      key: e.target.value,
                      value: config.apiKey?.value || "",
                      location: config.apiKey?.location || "header",
                    })
                  }
                  placeholder="X-API-Key"
                  sx={{ flex: 1 }}
                />
                <FormControl sx={{ minWidth: 120 }}>
                  <InputLabel>Location</InputLabel>
                  <Select
                    value={config.apiKey?.location || "header"}
                    label="Location"
                    onChange={(e) =>
                      updateConfig("apiKey", {
                        ...config.apiKey,
                        key: config.apiKey?.key || "",
                        value: config.apiKey?.value || "",
                        location: e.target.value as "header" | "query",
                      })
                    }
                  >
                    <MenuItem value="header">Header</MenuItem>
                    <MenuItem value="query">Query Parameter</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              <TextField
                fullWidth
                label="API Key Value"
                value={config.apiKey?.value || ""}
                onChange={(e) =>
                  updateConfig("apiKey", {
                    ...config.apiKey,
                    key: config.apiKey?.key || "",
                    value: e.target.value,
                    location: config.apiKey?.location || "header",
                  })
                }
                type={showPasswords.apikey ? "text" : "password"}
                placeholder="your-api-key-value"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => togglePasswordVisibility("apikey")}>
                        {showPasswords.apikey ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <Alert severity="info">
                {config.apiKey?.location === "header"
                  ? `Will be sent as header: ${config.apiKey.key || "X-API-Key"}: <value>`
                  : `Will be sent as query parameter: ?${config.apiKey?.key || "api_key"}=<value>`}
              </Alert>
            </Box>
          </TabPanel>

          {/* Custom Headers */}
          <TabPanel value={config.type} index="custom">
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Typography variant="subtitle1" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Security /> Custom Authentication Headers
              </Typography>
              <Alert severity="info">
                Add custom headers for authentication. These will be sent with every request.
              </Alert>

              {/* Custom Headers */}
              {Object.entries(config.customHeaders || {}).map(([key, value], index) => (
                <Box key={index} sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                  <TextField
                    label="Header Name"
                    value={key}
                    onChange={(e) => {
                      const newHeaders = { ...config.customHeaders };
                      delete newHeaders[key];
                      newHeaders[e.target.value] = value;
                      updateConfig("customHeaders", newHeaders);
                    }}
                    sx={{ flex: 1 }}
                    placeholder="X-Custom-Auth"
                  />
                  <TextField
                    label="Header Value"
                    value={value}
                    onChange={(e) => {
                      const newHeaders = { ...config.customHeaders };
                      newHeaders[key] = e.target.value;
                      updateConfig("customHeaders", newHeaders);
                    }}
                    sx={{ flex: 2 }}
                    type={showPasswords[`custom-${index}`] ? "text" : "password"}
                    placeholder="secret-value"
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={() => togglePasswordVisibility(`custom-${index}`)}>
                            {showPasswords[`custom-${index}`] ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                  <IconButton
                    onClick={() => {
                      const newHeaders = { ...config.customHeaders };
                      delete newHeaders[key];
                      updateConfig("customHeaders", newHeaders);
                    }}
                    color="error"
                  >
                    <VisibilityOff />
                  </IconButton>
                </Box>
              ))}

              <Button
                onClick={() => {
                  const newHeaders = { ...config.customHeaders, "": "" };
                  updateConfig("customHeaders", newHeaders);
                }}
                variant="outlined"
                size="small"
              >
                Add Custom Header
              </Button>
            </Box>
          </TabPanel>
        </Box>
      )}

      {/* Test Authentication */}
      {config.type !== "none" && onTestAuth && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<Science />}
            onClick={onTestAuth}
            disabled={testingAuth}
            sx={{ alignSelf: "flex-start" }}
          >
            {testingAuth ? "Testing Authentication..." : "Test Authentication"}
          </Button>

          {testResult && (
            <Alert severity={testResult.success ? "success" : "error"}>
              {testResult.success ? (
                <Box>
                  <Typography variant="body2">
                    ✓ Authentication successful! Status: {testResult.statusCode || "200"}
                  </Typography>
                </Box>
              ) : (
                <Box>
                  <Typography variant="body2">✗ Authentication failed</Typography>
                  {testResult.error && (
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Error: {testResult.error}
                    </Typography>
                  )}
                </Box>
              )}
            </Alert>
          )}
        </Box>
      )}

      {/* Security Notice */}
      <Accordion sx={{ mt: 2 }}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="body2" color="text.secondary">
            🔒 Security & Best Practices
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <Typography variant="body2">
              • <strong>Tokens & Passwords:</strong> Use environment variables or secure storage for
              production credentials
            </Typography>
            <Typography variant="body2">
              • <strong>API Keys:</strong> Rotate keys regularly and use keys with minimal required permissions
            </Typography>
            <Typography variant="body2">
              • <strong>Bearer Tokens:</strong> Check token expiration and implement refresh logic if needed
            </Typography>
            <Typography variant="body2">
              • <strong>Testing:</strong> Use separate test credentials that don't access production data
            </Typography>
          </Box>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};

export default AuthConfigComponent;
