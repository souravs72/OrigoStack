package simulator

import (
	"context"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/origo-stack/performance-simulator/internal/metrics"
	"github.com/origo-stack/performance-simulator/internal/websocket"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

// Engine manages performance simulations
type Engine struct {
	db               *gorm.DB
	metricsCollector *metrics.Collector
	wsHub            *websocket.Hub
	activeSimulations sync.Map
	simulationCounter int64
}

// SimulationConfig defines a performance test configuration
type SimulationConfig struct {
	ID               int64             `json:"id"`
	Name             string            `json:"name"`
	TargetURL        string            `json:"target_url"`
	Method           string            `json:"method"`
	Headers          map[string]string `json:"headers"`
	Body             string            `json:"body"`
	MaxRPS           int64             `json:"max_rps"`           // Changed to int64 for millions of RPS
	MinRPS           int64             `json:"min_rps"`           // Starting RPS (default: 1)
	Duration         time.Duration     `json:"duration"`
	ConcurrentUsers  int               `json:"concurrent_users"`
	RampUpTime       time.Duration     `json:"ramp_up_time"`
	Pattern          LoadPattern       `json:"pattern"`
	ScaleMode        ScaleMode         `json:"scale_mode"`        // Linear, Logarithmic, Exponential
	SampleInterval   time.Duration     `json:"sample_interval"`   // Time-series sampling rate
}

// LoadPattern defines different load generation patterns
type LoadPattern string

const (
	PatternConstant     LoadPattern = "constant"
	PatternLinearRamp   LoadPattern = "linear_ramp"
	PatternExponential  LoadPattern = "exponential"
	PatternSpike        LoadPattern = "spike"
	PatternSineWave     LoadPattern = "sine_wave"
	PatternStepRamp     LoadPattern = "step_ramp"      // Step-wise increases
	PatternMegaScale    LoadPattern = "mega_scale"     // 1 RPS to millions/sec
	PatternLogarithmic  LoadPattern = "logarithmic"    // Logarithmic growth
)

// ScaleMode defines how RPS scaling is calculated
type ScaleMode string

const (
	ScaleModeLinear      ScaleMode = "linear"
	ScaleModeLogarithmic ScaleMode = "logarithmic"  
	ScaleModeExponential ScaleMode = "exponential"
	ScaleModeStep        ScaleMode = "step"
)

// SimulationStatus represents the current state of a simulation
type SimulationStatus struct {
	ID              int64                    `json:"id"`
	Name            string                   `json:"name"`
	Status          string                   `json:"status"`
	StartTime       time.Time                `json:"start_time"`
	EndTime         *time.Time               `json:"end_time,omitempty"`
	TotalRequests   int64                    `json:"total_requests"`
	SuccessfulReqs  int64                    `json:"successful_requests"`
	FailedRequests  int64                    `json:"failed_requests"`
	AverageRPS      float64                  `json:"average_rps"`
	CurrentRPS      float64                  `json:"current_rps"`
	ResponseTimes   *metrics.ResponseTimes   `json:"response_times"`
	Config          *SimulationConfig        `json:"config"`
}

// Simulation represents an active performance test
type Simulation struct {
	config        *SimulationConfig
	status        *SimulationStatus
	ctx           context.Context
	cancel        context.CancelFunc
	requestCount  int64
	successCount  int64
	errorCount    int64
	mu            sync.RWMutex
	client        *http.Client
	responseTimes []time.Duration
	timeSeries    *TimeSeriesMetrics
}

// NewEngine creates a new simulation engine
func NewEngine(db *gorm.DB, metricsCollector *metrics.Collector, wsHub *websocket.Hub) *Engine {
	return &Engine{
		db:               db,
		metricsCollector: metricsCollector,
		wsHub:            wsHub,
		simulationCounter: 0,
	}
}

// StartSimulation initiates a new performance test
func (e *Engine) StartSimulation(c *gin.Context) {
	var config SimulationConfig
	if err := c.ShouldBindJSON(&config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid configuration: " + err.Error()})
		return
	}

	// Generate unique simulation ID
	config.ID = atomic.AddInt64(&e.simulationCounter, 1)

	// Validate configuration
	if err := e.validateConfig(&config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Configuration validation failed: " + err.Error()})
		return
	}

	// Create simulation context
	ctx, cancel := context.WithTimeout(context.Background(), config.Duration)
	
	// Initialize simulation
	sim := &Simulation{
		config: &config,
		status: &SimulationStatus{
			ID:        config.ID,
			Name:      config.Name,
			Status:    "starting",
			StartTime: time.Now(),
		},
		ctx:    ctx,
		cancel: cancel,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
		responseTimes: make([]time.Duration, 0, 10000),
		timeSeries: &TimeSeriesMetrics{
			SimulationID: config.ID,
			Points:       make([]TimeSeriesPoint, 0, 10000),
		},
	}

	// Store simulation
	e.activeSimulations.Store(config.ID, sim)

	// Start simulation in goroutine
	go e.runSimulation(sim)

	// Save configuration to database
	go e.saveSimulationToDB(sim)

	c.JSON(http.StatusCreated, gin.H{
		"simulation_id": config.ID,
		"status":       "started",
		"message":      fmt.Sprintf("Simulation '%s' started successfully", config.Name),
	})
}

// runSimulation executes the performance test
func (e *Engine) runSimulation(sim *Simulation) {
	defer func() {
		sim.status.Status = "completed"
		endTime := time.Now()
		sim.status.EndTime = &endTime
		
		// Calculate final metrics
		e.calculateFinalMetrics(sim)
		
		// Broadcast final status
		e.wsHub.Broadcast("simulation_completed", sim.status)
		
		// Clean up
		sim.cancel()
	}()

	logrus.Infof("Starting simulation: %s (ID: %d)", sim.config.Name, sim.config.ID)
	sim.status.Status = "running"

	// Create worker pool
	workerPool := make(chan struct{}, sim.config.ConcurrentUsers)
	var wg sync.WaitGroup

	// Start metrics reporting goroutine
	go e.reportMetrics(sim)

	// Generate load based on pattern
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()

	startTime := time.Now()
	
	for {
		select {
		case <-sim.ctx.Done():
			logrus.Infof("Simulation %d completed", sim.config.ID)
			return
		case <-ticker.C:
			elapsed := time.Since(startTime)
			targetRPS := e.calculateTargetRPS(sim.config, elapsed)
			
			// Launch requests for this second
			for i := 0; i < int(targetRPS); i++ {
				select {
				case workerPool <- struct{}{}:
					wg.Add(1)
					go e.executeRequest(sim, workerPool, &wg)
				case <-sim.ctx.Done():
					return
				default:
					// Worker pool full, skip this request
				}
			}
		}
	}
}

// executeRequest performs a single HTTP request
func (e *Engine) executeRequest(sim *Simulation, workerPool <-chan struct{}, wg *sync.WaitGroup) {
	defer func() {
		<-workerPool
		wg.Done()
	}()

	startTime := time.Now()
	
	// Create HTTP request
	req, err := http.NewRequestWithContext(sim.ctx, sim.config.Method, sim.config.TargetURL, nil)
	if err != nil {
		atomic.AddInt64(&sim.errorCount, 1)
		return
	}

	// Add headers
	for key, value := range sim.config.Headers {
		req.Header.Set(key, value)
	}

	// Execute request
	resp, err := sim.client.Do(req)
	responseTime := time.Since(startTime)
	
	atomic.AddInt64(&sim.requestCount, 1)

	if err != nil {
		atomic.AddInt64(&sim.errorCount, 1)
		logrus.Debugf("Request failed: %v", err)
		return
	}
	defer resp.Body.Close()

	// Check response status
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		atomic.AddInt64(&sim.successCount, 1)
	} else {
		atomic.AddInt64(&sim.errorCount, 1)
	}

	// Record response time
	sim.mu.Lock()
	sim.responseTimes = append(sim.responseTimes, responseTime)
	sim.mu.Unlock()
}

// calculateTargetRPS determines the target RPS based on load pattern and elapsed time
func (e *Engine) calculateTargetRPS(config *SimulationConfig, elapsed time.Duration) float64 {
	progress := elapsed.Seconds() / config.Duration.Seconds()
	if progress > 1.0 {
		progress = 1.0
	}
	
	minRPS := float64(config.MinRPS)
	if minRPS == 0 {
		minRPS = 1.0 // Default to 1 RPS minimum
	}
	maxRPS := float64(config.MaxRPS)
	
	switch config.Pattern {
	case PatternConstant:
		return maxRPS
		
	case PatternLinearRamp:
		rampProgress := elapsed.Seconds() / config.RampUpTime.Seconds()
		if rampProgress > 1.0 {
			rampProgress = 1.0
		}
		return minRPS + (maxRPS-minRPS)*rampProgress
		
	case PatternMegaScale:
		// Scale from 1 RPS to millions/sec over duration
		return e.calculateMegaScale(minRPS, maxRPS, progress, config.ScaleMode)
		
	case PatternLogarithmic:
		// Logarithmic growth: slow start, rapid acceleration
		if progress == 0 {
			return minRPS
		}
		logProgress := math.Log10(1+9*progress) // 0 to 1
		return minRPS + (maxRPS-minRPS)*logProgress
		
	case PatternExponential:
		// Exponential growth: rapid early growth
		expProgress := (math.Exp(progress) - 1) / (math.E - 1)
		return minRPS + (maxRPS-minRPS)*expProgress
		
	case PatternStepRamp:
		// Step-wise increases every 10% of duration
		stepProgress := math.Floor(progress*10) / 10
		return minRPS + (maxRPS-minRPS)*stepProgress
		
	case PatternSpike:
		// Spike at 50% of duration
		midpoint := config.Duration.Seconds() / 2
		if elapsed.Seconds() >= midpoint-5 && elapsed.Seconds() <= midpoint+5 {
			return maxRPS
		}
		return maxRPS * 0.1
		
	case PatternSineWave:
		// Sine wave pattern over duration
		cycles := 3.0 // 3 complete cycles over duration
		sineValue := math.Sin(2 * math.Pi * cycles * progress)
		amplitude := (maxRPS - minRPS) / 2
		baseline := minRPS + amplitude
		return baseline + amplitude*sineValue
		
	default:
		return maxRPS
	}
}

// calculateMegaScale implements mega-scale RPS calculation
func (e *Engine) calculateMegaScale(minRPS, maxRPS, progress float64, mode ScaleMode) float64 {
	switch mode {
	case ScaleModeLinear:
		return minRPS + (maxRPS-minRPS)*progress
		
	case ScaleModeLogarithmic:
		if progress == 0 {
			return minRPS
		}
		// Logarithmic scale: log10(1 + 9*progress) maps 0->0, 1->1
		logProgress := math.Log10(1+9*progress)
		return minRPS + (maxRPS-minRPS)*logProgress
		
	case ScaleModeExponential:
		// Exponential scale: 10^(3*progress) for rapid scaling
		if maxRPS >= 1000000 { // For millions scale
			expProgress := (math.Pow(10, 6*progress) - 1) / (1000000 - 1)
			return minRPS + (maxRPS-minRPS)*expProgress
		} else {
			// Standard exponential
			expProgress := (math.Exp(progress) - 1) / (math.E - 1)
			return minRPS + (maxRPS-minRPS)*expProgress
		}
		
	case ScaleModeStep:
		// Powers of 10 steps: 1, 10, 100, 1K, 10K, 100K, 1M
		steps := []float64{1, 10, 100, 1000, 10000, 100000, 1000000}
		stepIndex := int(progress * float64(len(steps)-1))
		if stepIndex >= len(steps) {
			stepIndex = len(steps) - 1
		}
		target := steps[stepIndex]
		if target > maxRPS {
			return maxRPS
		}
		return math.Max(target, minRPS)
		
	default:
		return minRPS + (maxRPS-minRPS)*progress
	}
}

// TimeSeriesPoint represents a single data point in time-series metrics
type TimeSeriesPoint struct {
	Timestamp    time.Time `json:"timestamp"`
	RPS          float64   `json:"rps"`
	TargetRPS    float64   `json:"target_rps"`
	ResponseTime float64   `json:"response_time"`
	ErrorRate    float64   `json:"error_rate"`
	ActiveUsers  int       `json:"active_users"`
}

// TimeSeriesMetrics stores historical performance data
type TimeSeriesMetrics struct {
	SimulationID int64             `json:"simulation_id"`
	Points       []TimeSeriesPoint `json:"points"`
	mu           sync.RWMutex
}

// AddPoint adds a new data point to the time series
func (tsm *TimeSeriesMetrics) AddPoint(point TimeSeriesPoint) {
	tsm.mu.Lock()
	defer tsm.mu.Unlock()
	
	tsm.Points = append(tsm.Points, point)
	
	// Keep only last 10000 points to prevent memory issues
	if len(tsm.Points) > 10000 {
		tsm.Points = tsm.Points[len(tsm.Points)-10000:]
	}
}

// GetPointsSince returns points since a specific timestamp
func (tsm *TimeSeriesMetrics) GetPointsSince(since time.Time) []TimeSeriesPoint {
	tsm.mu.RLock()
	defer tsm.mu.RUnlock()
	
	var result []TimeSeriesPoint
	for _, point := range tsm.Points {
		if point.Timestamp.After(since) {
			result = append(result, point)
		}
	}
	return result
}

// reportMetrics sends real-time metrics via WebSocket
func (e *Engine) reportMetrics(sim *Simulation) {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	var lastRequestCount int64

	for {
		select {
		case <-sim.ctx.Done():
			return
		case <-ticker.C:
			currentRequests := atomic.LoadInt64(&sim.requestCount)
			currentRPS := float64(currentRequests - lastRequestCount)
			lastRequestCount = currentRequests

			// Update status
			sim.mu.Lock()
			sim.status.TotalRequests = atomic.LoadInt64(&sim.requestCount)
			sim.status.SuccessfulReqs = atomic.LoadInt64(&sim.successCount)
			sim.status.FailedRequests = atomic.LoadInt64(&sim.errorCount)
			sim.status.CurrentRPS = currentRPS
			
			// Calculate response time percentiles
			var avgResponseTime float64
			if len(sim.responseTimes) > 0 {
				sim.status.ResponseTimes = metrics.CalculatePercentiles(sim.responseTimes)
				// Calculate average response time for time series
				var totalTime time.Duration
				for _, rt := range sim.responseTimes {
					totalTime += rt
				}
				avgResponseTime = float64(totalTime.Nanoseconds()) / float64(len(sim.responseTimes)) / 1000000 // Convert to milliseconds
			}
			
			// Calculate current target RPS
			elapsed := time.Since(sim.status.StartTime)
			targetRPS := e.calculateTargetRPS(sim.config, elapsed)
			
			// Calculate error rate
			errorRate := 0.0
			if sim.status.TotalRequests > 0 {
				errorRate = float64(sim.status.FailedRequests) / float64(sim.status.TotalRequests) * 100
			}
			
			sim.mu.Unlock()

			// Add time-series data point
			timePoint := TimeSeriesPoint{
				Timestamp:    time.Now(),
				RPS:          currentRPS,
				TargetRPS:    targetRPS,
				ResponseTime: avgResponseTime,
				ErrorRate:    errorRate,
				ActiveUsers:  sim.config.ConcurrentUsers,
			}
			sim.timeSeries.AddPoint(timePoint)

			// Broadcast metrics with time-series data
			metricsUpdate := map[string]interface{}{
				"simulation":  sim.status,
				"time_series": timePoint,
				"target_rps":  targetRPS,
			}
			e.wsHub.Broadcast("metrics_update", metricsUpdate)
		}
	}
}

// calculateFinalMetrics computes final simulation statistics
func (e *Engine) calculateFinalMetrics(sim *Simulation) {
	duration := time.Since(sim.status.StartTime)
	totalRequests := atomic.LoadInt64(&sim.requestCount)
	
	if duration.Seconds() > 0 {
		sim.status.AverageRPS = float64(totalRequests) / duration.Seconds()
	}

	// Final response time statistics
	sim.mu.Lock()
	if len(sim.responseTimes) > 0 {
		sim.status.ResponseTimes = metrics.CalculatePercentiles(sim.responseTimes)
	}
	sim.mu.Unlock()
}

// validateConfig validates simulation configuration
func (e *Engine) validateConfig(config *SimulationConfig) error {
	if config.Name == "" {
		return fmt.Errorf("simulation name is required")
	}
	if config.TargetURL == "" {
		return fmt.Errorf("target URL is required")
	}
	if config.MaxRPS <= 0 {
		return fmt.Errorf("max RPS must be greater than 0")
	}
	if config.Duration <= 0 {
		return fmt.Errorf("duration must be greater than 0")
	}
	if config.ConcurrentUsers <= 0 {
		return fmt.Errorf("concurrent users must be greater than 0")
	}
	return nil
}

// GetTimeSeriesData retrieves historical time-series data for a simulation
func (e *Engine) GetTimeSeriesData(c *gin.Context) {
	simulationID := c.Param("id")
	
	// Parse query parameters
	sinceParam := c.DefaultQuery("since", "")
	limitParam := c.DefaultQuery("limit", "1000")
	
	var since time.Time
	if sinceParam != "" {
		if parsedTime, err := time.Parse(time.RFC3339, sinceParam); err == nil {
			since = parsedTime
		}
	}
	
	limit := 1000
	if parsedLimit, err := strconv.Atoi(limitParam); err == nil && parsedLimit > 0 {
		limit = parsedLimit
	}
	
	// Find simulation
	if simValue, exists := e.activeSimulations.Load(simulationID); exists {
		sim := simValue.(*Simulation)
		
		var points []TimeSeriesPoint
		if since.IsZero() {
			// Return last 'limit' points
			sim.timeSeries.mu.RLock()
			totalPoints := len(sim.timeSeries.Points)
			startIdx := 0
			if totalPoints > limit {
				startIdx = totalPoints - limit
			}
			points = make([]TimeSeriesPoint, totalPoints-startIdx)
			copy(points, sim.timeSeries.Points[startIdx:])
			sim.timeSeries.mu.RUnlock()
		} else {
			// Return points since timestamp
			points = sim.timeSeries.GetPointsSince(since)
			if len(points) > limit {
				points = points[len(points)-limit:]
			}
		}
		
		c.JSON(http.StatusOK, gin.H{
			"simulation_id": simulationID,
			"points":        points,
			"total_points":  len(points),
		})
		return
	}
	
	c.JSON(http.StatusNotFound, gin.H{"error": "Simulation not found"})
}

// GetMegaScalePresets returns predefined mega-scale simulation configurations
func (e *Engine) GetMegaScalePresets(c *gin.Context) {
	presets := map[string]SimulationConfig{
		"ramp_to_thousand": {
			Name:           "Ramp to 1K RPS",
			MinRPS:         1,
			MaxRPS:         1000,
			Duration:       5 * time.Minute,
			Pattern:        PatternMegaScale,
			ScaleMode:      ScaleModeLinear,
			SampleInterval: 1 * time.Second,
			ConcurrentUsers: 100,
		},
		"ramp_to_million": {
			Name:           "Ramp to 1M RPS",
			MinRPS:         1,
			MaxRPS:         1000000,
			Duration:       10 * time.Minute,
			Pattern:        PatternMegaScale,
			ScaleMode:      ScaleModeLogarithmic,
			SampleInterval: 1 * time.Second,
			ConcurrentUsers: 10000,
		},
		"exponential_scale": {
			Name:           "Exponential Scale Test",
			MinRPS:         1,
			MaxRPS:         500000,
			Duration:       8 * time.Minute,
			Pattern:        PatternMegaScale,
			ScaleMode:      ScaleModeExponential,
			SampleInterval: 500 * time.Millisecond,
			ConcurrentUsers: 5000,
		},
		"step_scale": {
			Name:           "Step Scale (Powers of 10)",
			MinRPS:         1,
			MaxRPS:         1000000,
			Duration:       7 * time.Minute,
			Pattern:        PatternMegaScale,
			ScaleMode:      ScaleModeStep,
			SampleInterval: 1 * time.Second,
			ConcurrentUsers: 1000,
		},
	}
	
	c.JSON(http.StatusOK, presets)
}

// saveSimulationToDB persists simulation configuration and results
func (e *Engine) saveSimulationToDB(sim *Simulation) {
	// Implementation would save to database
	// This is a placeholder for the database operations
	logrus.Infof("Saving simulation %d to database", sim.config.ID)
}

// Additional handler methods for REST API endpoints
func (e *Engine) ListSimulations(c *gin.Context) {
	// Implementation to list all simulations
	c.JSON(http.StatusOK, gin.H{"message": "List simulations endpoint"})
}

func (e *Engine) GetSimulation(c *gin.Context) {
	// Implementation to get specific simulation
	c.JSON(http.StatusOK, gin.H{"message": "Get simulation endpoint"})
}

func (e *Engine) StopSimulation(c *gin.Context) {
	// Implementation to stop running simulation
	c.JSON(http.StatusOK, gin.H{"message": "Stop simulation endpoint"})
}

func (e *Engine) DeleteSimulation(c *gin.Context) {
	// Implementation to delete simulation
	c.JSON(http.StatusOK, gin.H{"message": "Delete simulation endpoint"})
}

func (e *Engine) GetConfigurations(c *gin.Context) {
	// Implementation to get saved configurations
	c.JSON(http.StatusOK, gin.H{"message": "Get configurations endpoint"})
}

func (e *Engine) SaveConfiguration(c *gin.Context) {
	// Implementation to save configuration
	c.JSON(http.StatusOK, gin.H{"message": "Save configuration endpoint"})
}

func (e *Engine) GetServiceProfiles(c *gin.Context) {
	// Implementation to get service profiles
	c.JSON(http.StatusOK, gin.H{"message": "Get service profiles endpoint"})
}

func (e *Engine) CreateServiceProfile(c *gin.Context) {
	// Implementation to create service profile
	c.JSON(http.StatusOK, gin.H{"message": "Create service profile endpoint"})
}
