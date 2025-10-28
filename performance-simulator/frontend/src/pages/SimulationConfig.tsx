import React from "react";
import { Typography, Box, Card, CardContent } from "@mui/material";

const SimulationConfig: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
        Simulation Configuration
      </Typography>
      <Card>
        <CardContent>
          <Typography variant="body1">
            Simulation configuration page - Coming soon!
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            This page will allow you to configure and start new performance
            simulations.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default SimulationConfig;
