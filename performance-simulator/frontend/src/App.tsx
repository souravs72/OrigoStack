import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { CssBaseline, Box } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";

// Components
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import SimulationConfig from "./pages/SimulationConfig";
import ResultsAnalysis from "./pages/ResultsAnalysis";
import ServiceComparison from "./pages/ServiceComparison";
import LiveMonitoring from "./pages/LiveMonitoring";
import MegaScaleSimulation from "./pages/MegaScaleSimulation";

// Hooks and Utils
import { useWebSocket } from "./hooks/useWebSocket";

// Theme configuration
const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#2196f3",
      dark: "#1976d2",
      light: "#42a5f5",
    },
    secondary: {
      main: "#f50057",
      dark: "#c51162",
      light: "#ff5983",
    },
    background: {
      default: "#0a0e27",
      paper: "#1a1d3a",
    },
    text: {
      primary: "#ffffff",
      secondary: "#b0bec5",
    },
    success: {
      main: "#4caf50",
    },
    warning: {
      main: "#ff9800",
    },
    error: {
      main: "#f44336",
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: "linear-gradient(135deg, #1a1d3a 0%, #2a2d5a 100%)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          borderRadius: 8,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "linear-gradient(135deg, #1a1d3a 0%, #2a2d5a 100%)",
        },
      },
    },
  },
});

// React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

const App: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = React.useState(true);

  // Initialize WebSocket connection
  useWebSocket("ws://localhost:8080/ws");

  const handleSidebarToggle = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Router>
          <Box sx={{ display: "flex", minHeight: "100vh" }}>
            {/* Sidebar */}
            <Sidebar open={sidebarOpen} onToggle={handleSidebarToggle} />

            {/* Main Content */}
            <Box
              component="main"
              sx={{
                flexGrow: 1,
                display: "flex",
                flexDirection: "column",
                transition: theme.transitions.create(["margin"], {
                  easing: theme.transitions.easing.sharp,
                  duration: theme.transitions.duration.leavingScreen,
                }),
                marginLeft: sidebarOpen ? 0 : "-240px",
              }}
            >
              {/* Top Navigation */}
              <Navbar onSidebarToggle={handleSidebarToggle} />

              {/* Page Content */}
              <Box
                sx={{
                  flexGrow: 1,
                  p: 3,
                  backgroundColor: "background.default",
                  minHeight: "calc(100vh - 64px)",
                }}
              >
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route
                    path="/simulation/config"
                    element={<SimulationConfig />}
                  />
                  <Route path="/simulation/live" element={<LiveMonitoring />} />
                  <Route
                    path="/simulation/megascale"
                    element={<MegaScaleSimulation />}
                  />
                  <Route path="/results" element={<ResultsAnalysis />} />
                  <Route path="/comparison" element={<ServiceComparison />} />
                </Routes>
              </Box>
            </Box>
          </Box>
        </Router>

        {/* Toast Notifications */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: theme.palette.background.paper,
              color: theme.palette.text.primary,
              border: `1px solid ${theme.palette.divider}`,
            },
          }}
        />
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
