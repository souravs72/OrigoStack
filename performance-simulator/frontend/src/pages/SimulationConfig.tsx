import React, { useState, useCallback } from "react";
import {
  Box,
  Typography,
  Stepper,
  Step,
  StepLabel,
  Button,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Fab,
  Backdrop,
  CircularProgress,
} from "@mui/material";
import {
  NavigateNext,
  NavigateBefore,
  PlayArrow,
  Save,
  Upload,
  Settings,
  Refresh,
} from "@mui/icons-material";
import axios from "axios";
import { toast } from "react-hot-toast";

// Components
import BasicSettings from "../components/config/BasicSettings";
import RequestConfigComponent from "../components/config/RequestConfig";
import AuthConfigComponent from "../components/config/AuthConfig";
import LoadConfigComponent from "../components/config/LoadConfig";
import ValidationConfigComponent from "../components/config/ValidationConfig";
import RequestPreview from "../components/config/RequestPreview";

// Types
import {
  CompleteSimulationConfig,
  DEFAULT_CONFIG,
  CONFIG_TEMPLATES,
  FormErrors,
  FormTouched,
  TestConnectionResponse,
} from "../types/SimulationConfig";

const steps = [
  "Basic Settings",
  "Request Configuration", 
  "Authentication",
  "Load Configuration",
  "Response Validation",
  "Review & Test",
];

const SimulationConfig: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [config, setConfig] = useState<CompleteSimulationConfig>(DEFAULT_CONFIG);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<FormTouched>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testingAuth, setTestingAuth] = useState(false);
  const [connectionResult, setConnectionResult] = useState<TestConnectionResponse | null>(null);
  const [authTestResult, setAuthTestResult] = useState<any>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");

  // Validation functions
  const validateStep = (step: number): { isValid: boolean; errors: FormErrors } => {
    const newErrors: FormErrors = {};

    switch (step) {
      case 0: // Basic Settings
        if (!config.name.trim()) newErrors.name = "Test name is required";
        if (!config.targetUrl.trim()) {
          newErrors.targetUrl = "Target URL is required";
        } else {
          try {
            new URL(config.targetUrl);
          } catch {
            newErrors.targetUrl = "Invalid URL format";
          }
        }
        if (config.timeout < 1 || config.timeout > 300) {
          newErrors.timeout = "Timeout must be between 1-300 seconds";
        }
        break;

      case 2: // Authentication
        if (config.auth.type === "bearer" && !config.auth.token) {
          newErrors.auth = "Bearer token is required";
        }
        if (config.auth.type === "basic" && (!config.auth.username || !config.auth.password)) {
          newErrors.auth = "Username and password are required for basic auth";
        }
        if (config.auth.type === "apikey" && (!config.auth.apiKey?.key || !config.auth.apiKey?.value)) {
          newErrors.auth = "API key name and value are required";
        }
        break;

      case 3: // Load Configuration
        if (config.load.minRps < 1) newErrors.load = "Minimum RPS must be at least 1";
        if (config.load.maxRps < config.load.minRps) {
          newErrors.load = "Maximum RPS must be greater than minimum RPS";
        }
        if (config.load.duration < 1) newErrors.load = "Duration must be at least 1 minute";
        if (config.load.concurrentUsers < 1) {
          newErrors.load = "Concurrent users must be at least 1";
        }
        break;
    }

    return { isValid: Object.keys(newErrors).length === 0, errors: newErrors };
  };

  // Event handlers
  const handleNext = () => {
    const validation = validateStep(activeStep);
    if (validation.isValid) {
      setActiveStep((prevActiveStep) => prevActiveStep + 1);
      setErrors({});
    } else {
      setErrors(validation.errors);
      // Mark all fields as touched for this step
      const newTouched: FormTouched = { ...touched };
      Object.keys(validation.errors).forEach(key => {
        newTouched[key] = true;
      });
      setTouched(newTouched);
    }
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleBasicSettingsChange = useCallback((field: keyof typeof config, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleBasicSettingsBlur = useCallback((field: keyof typeof config) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  }, []);

  const handleRequestConfigChange = useCallback((requestConfig: typeof config.request) => {
    setConfig(prev => ({ ...prev, request: requestConfig }));
  }, []);

  const handleAuthConfigChange = useCallback((authConfig: typeof config.auth) => {
    setConfig(prev => ({ ...prev, auth: authConfig }));
  }, []);

  const handleLoadConfigChange = useCallback((loadConfig: typeof config.load) => {
    setConfig(prev => ({ ...prev, load: loadConfig }));
  }, []);

  const handleValidationConfigChange = useCallback((validationConfig: typeof config.validation) => {
    setConfig(prev => ({ ...prev, validation: validationConfig }));
  }, []);

  // API calls
  const testConnection = async () => {
    setTestingConnection(true);
    setConnectionResult(null);
    
    try {
      const response = await axios.post('/api/v1/test-connection', {
        target_url: config.targetUrl,
        method: config.method,
        headers: config.request.headers,
        auth: config.auth,
        timeout: config.timeout,
      });
      
      setConnectionResult(response.data);
      if (response.data.success) {
        toast.success('Connection test successful!');
      } else {
        toast.error('Connection test failed');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Connection test failed';
      setConnectionResult({
        success: false,
        error: errorMessage,
      });
      toast.error(`Connection test failed: ${errorMessage}`);
    } finally {
      setTestingConnection(false);
    }
  };

  const testAuth = async () => {
    setTestingAuth(true);
    setAuthTestResult(null);
    
    try {
      const response = await axios.post('/api/v1/auth/test', {
        auth_type: config.auth.type,
        target_url: config.targetUrl,
        config: config.auth,
      });
      
      setAuthTestResult(response.data);
      if (response.data.success) {
        toast.success('Authentication test successful!');
      } else {
        toast.error('Authentication test failed');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Authentication test failed';
      setAuthTestResult({
        success: false,
        error: errorMessage,
      });
      toast.error(`Authentication test failed: ${errorMessage}`);
    } finally {
      setTestingAuth(false);
    }
  };

  const saveConfiguration = async () => {
    setSaving(true);
    
    try {
      await axios.post('/api/v1/configs', config);
      toast.success('Configuration saved successfully!');
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to save configuration';
      toast.error(`Failed to save configuration: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  const startSimulation = async () => {
    setTesting(true);
    
    try {
      // Convert duration from minutes to nanoseconds for backend
      const simulationConfig = {
        ...config,
        duration: config.load.duration * 60 * 1000 * 1000 * 1000, // Convert to nanoseconds
        max_rps: config.load.maxRps,
        min_rps: config.load.minRps,
        concurrent_users: config.load.concurrentUsers,
        pattern: config.load.pattern,
        scale_mode: config.load.scaleMode,
        sample_interval: 1000 * 1000 * 1000, // 1 second in nanoseconds
        target_url: config.targetUrl,
        method: config.method,
        headers: config.request.headers,
        body: config.request.body,
        auth: config.auth,
      };
      
      await axios.post('/api/v1/simulations', simulationConfig);
      toast.success(`Simulation "${config.name}" started successfully!`);
      
      // Optional: Navigate to live monitoring page
      // navigate('/simulation/live');
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to start simulation';
      toast.error(`Failed to start simulation: ${errorMessage}`);
    } finally {
      setTesting(false);
    }
  };

  const loadTemplate = (templateId: string) => {
    const template = CONFIG_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      setConfig(prev => ({
        ...prev,
        ...template.config,
        name: template.name,
        description: template.description,
      }));
      setTemplateDialogOpen(false);
      toast.success(`Loaded template: ${template.name}`);
    }
  };

  const exportConfiguration = () => {
    const dataStr = JSON.stringify(config, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `${config.name || 'simulation-config'}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    toast.success('Configuration exported successfully!');
  };

  const importConfiguration = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedConfig = JSON.parse(e.target?.result as string);
          setConfig({ ...DEFAULT_CONFIG, ...importedConfig });
          toast.success('Configuration imported successfully!');
        } catch (error) {
          toast.error('Failed to import configuration: Invalid JSON format');
        }
      };
      reader.readAsText(file);
    }
  };

  // Render step content
  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <BasicSettings
            config={config}
            errors={errors}
            touched={touched}
            onChange={handleBasicSettingsChange}
            onBlur={handleBasicSettingsBlur}
          />
        );
      case 1:
        return (
          <RequestConfigComponent
            config={config.request}
            onChange={handleRequestConfigChange}
          />
        );
      case 2:
        return (
          <AuthConfigComponent
            config={config.auth}
            onChange={handleAuthConfigChange}
            onTestAuth={testAuth}
            testingAuth={testingAuth}
            testResult={authTestResult}
          />
        );
      case 3:
        return (
          <LoadConfigComponent
            config={config.load}
            onChange={handleLoadConfigChange}
          />
        );
      case 4:
        return (
          <ValidationConfigComponent
            config={config.validation}
            onChange={handleValidationConfigChange}
          />
        );
      case 5:
        return (
          <RequestPreview
            config={config}
            onTestConnection={testConnection}
            testingConnection={testingConnection}
            connectionResult={connectionResult}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" component="h1">
          <Settings sx={{ mr: 2, verticalAlign: 'bottom' }} />
          Simulation Configuration
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            onClick={() => setTemplateDialogOpen(true)}
            startIcon={<Refresh />}
            size="small"
          >
            Templates
          </Button>
          <Button
            variant="outlined"
            onClick={exportConfiguration}
            startIcon={<Save />}
            size="small"
          >
            Export
          </Button>
          <Button
            variant="outlined"
            component="label"
            startIcon={<Upload />}
            size="small"
          >
            Import
            <input
              type="file"
              accept=".json"
              hidden
              onChange={importConfiguration}
            />
          </Button>
        </Box>
      </Box>

      {/* Progress Stepper */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Stepper activeStep={activeStep} alternativeLabel>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Paper>

      {/* Step Content */}
      <Paper sx={{ p: 4, mb: 3, minHeight: 400 }}>
        {renderStepContent(activeStep)}
      </Paper>

      {/* Navigation */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button
          disabled={activeStep === 0}
          onClick={handleBack}
          startIcon={<NavigateBefore />}
        >
          Back
        </Button>

        <Box sx={{ display: 'flex', gap: 2 }}>
          {activeStep === steps.length - 1 ? (
            <>
              <Button
                variant="outlined"
                onClick={saveConfiguration}
                disabled={saving}
                startIcon={<Save />}
              >
                {saving ? 'Saving...' : 'Save Configuration'}
              </Button>
              <Button
                variant="contained"
                onClick={startSimulation}
                disabled={testing}
                startIcon={<PlayArrow />}
                color="primary"
              >
                {testing ? 'Starting...' : 'Start Simulation'}
              </Button>
            </>
          ) : (
            <Button
              variant="contained"
              onClick={handleNext}
              endIcon={<NavigateNext />}
            >
              Next
            </Button>
          )}
        </Box>
      </Box>

      {/* Template Selection Dialog */}
      <Dialog open={templateDialogOpen} onClose={() => setTemplateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Choose Configuration Template</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Template</InputLabel>
            <Select
              value={selectedTemplate}
              label="Template"
              onChange={(e) => setSelectedTemplate(e.target.value)}
            >
              {CONFIG_TEMPLATES.map((template) => (
                <MenuItem key={template.id} value={template.id}>
                  <Box>
                    <Typography variant="body1">{template.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {template.description}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTemplateDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={() => loadTemplate(selectedTemplate)}
            disabled={!selectedTemplate}
            variant="contained"
          >
            Load Template
          </Button>
        </DialogActions>
      </Dialog>

      {/* Loading Backdrop */}
      <Backdrop open={testing} sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <CircularProgress color="primary" />
          <Typography variant="h6" color="white">
            Starting simulation...
          </Typography>
        </Box>
      </Backdrop>

      {/* Quick Start FAB */}
      <Fab
        color="primary"
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
        }}
        onClick={() => setTemplateDialogOpen(true)}
      >
        <Settings />
      </Fab>
    </Box>
  );
};

export default SimulationConfig;
