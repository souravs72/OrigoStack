import React from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
  Chip,
} from "@mui/material";
import { Menu } from "@mui/icons-material";
import { simulatorStore } from "../stores/simulatorStore";

interface NavbarProps {
  onSidebarToggle: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ onSidebarToggle }) => {
  const connectionStatus = simulatorStore((state) => state.connectionStatus);
  const getActiveSimulationsCount = simulatorStore(
    (state) => state.getActiveSimulationsCount
  );

  return (
    <AppBar
      position="static"
      elevation={0}
      sx={{ backgroundColor: "background.paper" }}
    >
      <Toolbar>
        <IconButton
          edge="start"
          color="inherit"
          onClick={onSidebarToggle}
          sx={{ mr: 2 }}
        >
          <Menu />
        </IconButton>

        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          Origo Stack Performance Dashboard
        </Typography>

        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Chip
            label={`${getActiveSimulationsCount()} Active`}
            size="small"
            color="primary"
            variant="outlined"
          />
          <Chip
            label={connectionStatus}
            size="small"
            color={connectionStatus === "connected" ? "success" : "error"}
          />
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
