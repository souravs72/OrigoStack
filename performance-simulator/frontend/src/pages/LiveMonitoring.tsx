import React from "react";
import { Typography, Box, Card, CardContent } from "@mui/material";

const LiveMonitoring: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
        Live Performance Monitoring
      </Typography>
      <Card>
        <CardContent>
          <Typography variant="body1">
            Live monitoring page - Coming soon!
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default LiveMonitoring;
