import React from "react";
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Box,
  Divider,
} from "@mui/material";
import {
  Dashboard,
  Settings,
  PlayArrow,
  Analytics,
  Compare,
  History,
  Speed,
  TrendingUp,
} from "@mui/icons-material";
import { useNavigate, useLocation } from "react-router-dom";

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ open }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { text: "Dashboard", icon: <Dashboard />, path: "/dashboard" },
    { text: "Live Monitoring", icon: <Speed />, path: "/simulation/live" },
    { text: "New Simulation", icon: <PlayArrow />, path: "/simulation/config" },
    {
      text: "Mega-Scale Test",
      icon: <TrendingUp />,
      path: "/simulation/megascale",
    },
    { text: "Results Analysis", icon: <Analytics />, path: "/results" },
    { text: "Service Comparison", icon: <Compare />, path: "/comparison" },
    { text: "History", icon: <History />, path: "/history" },
    { text: "Settings", icon: <Settings />, path: "/settings" },
  ];

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  return (
    <Drawer
      variant="persistent"
      anchor="left"
      open={open}
      sx={{
        width: 240,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: 240,
          boxSizing: "border-box",
          backgroundColor: "background.paper",
          borderRight: "1px solid rgba(255, 255, 255, 0.12)",
        },
      }}
    >
      <Box sx={{ p: 2, textAlign: "center" }}>
        <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
          Performance Simulator
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Origo Stack Testing Suite
        </Typography>
      </Box>

      <Divider />

      <List>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => handleNavigation(item.path)}
              sx={{
                "&.Mui-selected": {
                  backgroundColor: "primary.main",
                  "&:hover": {
                    backgroundColor: "primary.dark",
                  },
                },
              }}
            >
              <ListItemIcon sx={{ color: "inherit" }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Drawer>
  );
};

export default Sidebar;
