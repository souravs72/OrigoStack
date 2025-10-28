package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/origo-stack/performance-simulator/internal/config"
	"github.com/origo-stack/performance-simulator/internal/database"
	"github.com/origo-stack/performance-simulator/internal/metrics"
	"github.com/origo-stack/performance-simulator/internal/simulator"
	"github.com/origo-stack/performance-simulator/internal/websocket"
	"github.com/sirupsen/logrus"
)

func main() {
	// Initialize logger
	logrus.SetLevel(logrus.InfoLevel)
	logrus.SetFormatter(&logrus.JSONFormatter{})

	// Load configuration
	cfg, err := config.Load("configs/config.yaml")
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Initialize database
	db, err := database.Initialize(cfg.Database.DSN())
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	// Initialize metrics collector
	metricsCollector := metrics.NewCollector()

	// Initialize WebSocket hub
	wsHub := websocket.NewHub()
	go wsHub.Run()

	// Initialize simulator engine
	simEngine := simulator.NewEngine(db, metricsCollector, wsHub)

	// Setup HTTP server
	router := setupRoutes(simEngine, wsHub, metricsCollector)
	
	server := &http.Server{
		Addr:    fmt.Sprintf(":%d", cfg.Server.Port),
		Handler: router,
	}

	// Start server in goroutine
	go func() {
		logrus.Infof("Performance Simulator starting on port %d", cfg.Server.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed to start: %v", err)
		}
	}()

	// Wait for interrupt signal for graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logrus.Info("Shutting down performance simulator...")

	// Graceful shutdown with 30 second timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	logrus.Info("Performance simulator stopped")
}

func setupRoutes(simEngine *simulator.Engine, wsHub *websocket.Hub, metricsCollector *metrics.Collector) *gin.Engine {
	// Set Gin to release mode for production
	gin.SetMode(gin.ReleaseMode)
	
	router := gin.Default()

	// CORS middleware for frontend
	router.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	// Health check endpoint
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "healthy",
			"timestamp": time.Now().Format(time.RFC3339),
			"version":   "1.0.0",
		})
	})

	// API routes
	api := router.Group("/api/v1")
	{
		// Simulation management
		api.POST("/simulations", simEngine.StartSimulation)
		api.GET("/simulations", simEngine.ListSimulations)
		api.GET("/simulations/:id", simEngine.GetSimulation)
		api.POST("/simulations/:id/stop", simEngine.StopSimulation)
		api.DELETE("/simulations/:id", simEngine.DeleteSimulation)

		// Configuration
		api.GET("/configs", simEngine.GetConfigurations)
		api.POST("/configs", simEngine.SaveConfiguration)
		
		// Real-time metrics
		api.GET("/metrics/live", metricsCollector.GetLiveMetrics)
		api.GET("/metrics/history/:simulationId", metricsCollector.GetHistoricalMetrics)
		
		// Time-series data
		api.GET("/simulations/:id/timeseries", simEngine.GetTimeSeriesData)
		
		// Mega-scale presets
		api.GET("/presets/megascale", simEngine.GetMegaScalePresets)

		// Service profiles
		api.GET("/services", simEngine.GetServiceProfiles)
		api.POST("/services", simEngine.CreateServiceProfile)
		
		// Testing endpoints
		api.POST("/test-connection", simEngine.TestConnection)
		api.POST("/auth/test", simEngine.TestAuth)
		
		// Variable management
		api.GET("/variables", simEngine.GetAvailableVariables)
		
		// Validation endpoints
		api.POST("/validation/test", simEngine.TestValidation)
		api.GET("/validation/results/:id", simEngine.GetValidationResults)
	}

	// WebSocket endpoint for real-time data
	router.GET("/ws", wsHub.HandleWebSocket)

	// Static file serving for frontend (if built)
	router.Static("/static", "../frontend/build/static")
	router.StaticFile("/", "../frontend/build/index.html")

	return router
}
