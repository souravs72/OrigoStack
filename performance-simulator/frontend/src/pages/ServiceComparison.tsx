import React from "react";
import { Typography, Box, Card, CardContent } from "@mui/material";

const ServiceComparison: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
        Service Performance Comparison
      </Typography>
      <Card>
        <CardContent>
          <Typography variant="body1">
            Service comparison page - Coming soon!
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ServiceComparison;
