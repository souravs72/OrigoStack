import React, { useState } from "react";
import {
  Box,
  Typography,
  TextField,
  IconButton,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Alert,
} from "@mui/material";
import {
  Add,
  Delete,
  ExpandMore,
  Code,
  ContentCopy,
  Help,
} from "@mui/icons-material";
import { RequestConfig, BodyType } from "../../types/SimulationConfig";

interface RequestConfigProps {
  config: RequestConfig;
  onChange: (config: RequestConfig) => void;
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

const RequestConfigComponent: React.FC<RequestConfigProps> = ({
  config,
  onChange,
}) => {
  const [tabValue, setTabValue] = useState(0);
  const [bodyTabValue, setBodyTabValue] = useState(0);

  // Header management
  const addHeader = () => {
    const newHeaders = { ...config.headers, "": "" };
    onChange({ ...config, headers: newHeaders });
  };

  const updateHeader = (oldKey: string, newKey: string, value: string) => {
    const newHeaders = { ...config.headers };
    if (oldKey !== newKey) {
      delete newHeaders[oldKey];
    }
    newHeaders[newKey] = value;
    onChange({ ...config, headers: newHeaders });
  };

  const removeHeader = (key: string) => {
    const newHeaders = { ...config.headers };
    delete newHeaders[key];
    onChange({ ...config, headers: newHeaders });
  };

  // Query parameter management
  const addQueryParam = () => {
    const newParams = { ...config.queryParams, "": "" };
    onChange({ ...config, queryParams: newParams });
  };

  const updateQueryParam = (oldKey: string, newKey: string, value: string) => {
    const newParams = { ...config.queryParams };
    if (oldKey !== newKey) {
      delete newParams[oldKey];
    }
    newParams[newKey] = value;
    onChange({ ...config, queryParams: newParams });
  };

  const removeQueryParam = (key: string) => {
    const newParams = { ...config.queryParams };
    delete newParams[key];
    onChange({ ...config, queryParams: newParams });
  };

  // Body management
  const updateBody = (field: keyof RequestConfig["body"], value: any) => {
    onChange({
      ...config,
      body: { ...config.body, [field]: value },
    });
  };

  // Common headers for quick add
  const commonHeaders = [
    { key: "Content-Type", value: "application/json" },
    { key: "Accept", value: "application/json" },
    { key: "User-Agent", value: "PerformanceSimulator/1.0" },
    { key: "Authorization", value: "Bearer <token>" },
    { key: "X-API-Key", value: "<api-key>" },
  ];

  const bodyTypeOptions: { value: BodyType; label: string; description: string }[] = [
    { value: "none", label: "None", description: "No request body" },
    { value: "json", label: "JSON", description: "JSON formatted data" },
    { value: "form", label: "Form Data", description: "URL-encoded form data" },
    { value: "multipart", label: "Multipart", description: "File uploads and form data" },
    { value: "raw", label: "Raw", description: "Plain text or custom format" },
    { value: "xml", label: "XML", description: "XML formatted data" },
  ];

  const getJsonSample = () => {
    return JSON.stringify(
      {
        name: "{{username}}",
        email: "{{email}}",
        age: "{{random_int}}",
        timestamp: "{{timestamp}}",
      },
      null,
      2
    );
  };

  const getFormSample = () => {
    return "name={{username}}&email={{email}}&subscription=premium";
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
        Request Configuration
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab label="Headers" />
          <Tab label="Query Parameters" />
          <Tab label="Request Body" />
        </Tabs>
      </Box>

      {/* Headers Tab */}
      <TabPanel value={tabValue} index={0}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Typography variant="subtitle1">HTTP Headers</Typography>
            <Button startIcon={<Add />} onClick={addHeader} size="small">
              Add Header
            </Button>
          </Box>

          {/* Common Headers */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="body2" color="text.secondary">
                Common Headers (click to add)
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {commonHeaders.map((header) => (
                  <Chip
                    key={header.key}
                    label={`${header.key}: ${header.value}`}
                    onClick={() => updateHeader("", header.key, header.value)}
                    size="small"
                    variant="outlined"
                    clickable
                  />
                ))}
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* Header Entries */}
          {Object.entries(config.headers).map(([key, value], index) => (
            <Box key={index} sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <TextField
                label="Header Name"
                value={key}
                onChange={(e) => updateHeader(key, e.target.value, value)}
                size="small"
                sx={{ flex: 1 }}
                placeholder="Content-Type"
              />
              <TextField
                label="Header Value"
                value={value}
                onChange={(e) => updateHeader(key, key, e.target.value)}
                size="small"
                sx={{ flex: 2 }}
                placeholder="application/json"
              />
              <IconButton onClick={() => removeHeader(key)} size="small" color="error">
                <Delete />
              </IconButton>
            </Box>
          ))}

          {Object.keys(config.headers).length === 0 && (
            <Alert severity="info">
              No headers configured. Click "Add Header" or select from common headers above.
            </Alert>
          )}
        </Box>
      </TabPanel>

      {/* Query Parameters Tab */}
      <TabPanel value={tabValue} index={1}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Typography variant="subtitle1">Query Parameters</Typography>
            <Button startIcon={<Add />} onClick={addQueryParam} size="small">
              Add Parameter
            </Button>
          </Box>

          {/* Query Parameter Entries */}
          {Object.entries(config.queryParams).map(([key, value], index) => (
            <Box key={index} sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <TextField
                label="Parameter Name"
                value={key}
                onChange={(e) => updateQueryParam(key, e.target.value, value)}
                size="small"
                sx={{ flex: 1 }}
                placeholder="limit"
              />
              <TextField
                label="Parameter Value"
                value={value}
                onChange={(e) => updateQueryParam(key, key, e.target.value)}
                size="small"
                sx={{ flex: 1 }}
                placeholder="100"
              />
              <IconButton onClick={() => removeQueryParam(key)} size="small" color="error">
                <Delete />
              </IconButton>
            </Box>
          ))}

          {Object.keys(config.queryParams).length === 0 && (
            <Alert severity="info">
              No query parameters configured. These will be appended to the URL as ?key=value&key2=value2
            </Alert>
          )}
        </Box>
      </TabPanel>

      {/* Request Body Tab */}
      <TabPanel value={tabValue} index={2}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Typography variant="subtitle1">Request Body</Typography>
            <FormControl sx={{ minWidth: 120 }}>
              <InputLabel>Body Type</InputLabel>
              <Select
                value={config.body.type}
                label="Body Type"
                onChange={(e) => updateBody("type", e.target.value as BodyType)}
                size="small"
              >
                {bodyTypeOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {/* Body Type Description */}
          <Alert severity="info">
            {bodyTypeOptions.find((opt) => opt.value === config.body.type)?.description}
          </Alert>

          {/* Body Content Editor */}
          {config.body.type !== "none" && (
            <Box>
              <Box sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}>
                <Tabs value={bodyTabValue} onChange={(_, newValue) => setBodyTabValue(newValue)}>
                  <Tab label="Content" icon={<Code />} />
                  <Tab label="Sample" icon={<ContentCopy />} />
                </Tabs>
              </Box>

              <TabPanel value={bodyTabValue} index={0}>
                <TextField
                  fullWidth
                  multiline
                  rows={8}
                  label="Request Body Content"
                  value={config.body.content}
                  onChange={(e) => updateBody("content", e.target.value)}
                  placeholder="Enter your request body content here..."
                  variant="outlined"
                  helperText="Use {{variable}} syntax for dynamic values like {{username}}, {{timestamp}}, {{random_int}}"
                />

                {/* Content Type Override */}
                {(config.body.type === "raw" || config.body.type === "xml") && (
                  <TextField
                    fullWidth
                    label="Content-Type Override"
                    value={config.body.contentType || ""}
                    onChange={(e) => updateBody("contentType", e.target.value)}
                    placeholder="text/plain, application/xml, etc."
                    sx={{ mt: 2 }}
                    helperText="Leave empty to use default Content-Type"
                  />
                )}
              </TabPanel>

              <TabPanel value={bodyTabValue} index={1}>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Sample content for {config.body.type.toUpperCase()} body type:
                  </Typography>

                  <TextField
                    fullWidth
                    multiline
                    rows={8}
                    value={
                      config.body.type === "json"
                        ? getJsonSample()
                        : config.body.type === "form"
                        ? getFormSample()
                        : config.body.type === "xml"
                        ? '<?xml version="1.0"?>\n<user>\n  <name>{{username}}</name>\n  <email>{{email}}</email>\n</user>'
                        : "Sample content for " + config.body.type
                    }
                    InputProps={{
                      readOnly: true,
                    }}
                    variant="outlined"
                  />

                  <Button
                    startIcon={<ContentCopy />}
                    onClick={() => {
                      const sample =
                        config.body.type === "json"
                          ? getJsonSample()
                          : config.body.type === "form"
                          ? getFormSample()
                          : "";
                      updateBody("content", sample);
                      setBodyTabValue(0); // Switch to content tab
                    }}
                    size="small"
                  >
                    Copy to Content
                  </Button>
                </Box>
              </TabPanel>
            </Box>
          )}

          {/* Variable Help */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="body2" color="text.secondary">
                <Help sx={{ mr: 1, verticalAlign: "middle" }} fontSize="small" />
                Available Variables
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <Typography variant="body2">
                  <code>{"{{username}}"}</code> - Random username
                </Typography>
                <Typography variant="body2">
                  <code>{"{{email}}"}</code> - Random email address
                </Typography>
                <Typography variant="body2">
                  <code>{"{{timestamp}}"}</code> - Current Unix timestamp
                </Typography>
                <Typography variant="body2">
                  <code>{"{{uuid}}"}</code> - Random UUID
                </Typography>
                <Typography variant="body2">
                  <code>{"{{random_int}}"}</code> - Random integer
                </Typography>
              </Box>
            </AccordionDetails>
          </Accordion>
        </Box>
      </TabPanel>
    </Box>
  );
};

export default RequestConfigComponent;
