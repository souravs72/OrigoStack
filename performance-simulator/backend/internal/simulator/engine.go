package simulator

import (
	"context"
	"fmt"
	"io"
	"math"
	"net/http"
	"regexp"
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
	authManager      *AuthManager
	varResolver      *VariableResolver
	validationEngine *ValidationEngine
	activeSimulations sync.Map
	simulationCounter int64
	validationResults sync.Map // Store validation results by simulation ID
}

// SimulationConfig defines a performance test configuration
type SimulationConfig struct {
	ID               int64                `json:"id"`
	Name             string               `json:"name"`
	TargetURL        string               `json:"target_url"`
	Method           string               `json:"method"`
	Headers          map[string]string    `json:"headers"`
	Body             *RequestBody         `json:"body"`
	Auth             *AuthConfig          `json:"auth"`
	Validation       *ResponseValidation  `json:"validation,omitempty"`
	ContentType      string               `json:"content_type"`
	MaxRPS           int64                `json:"max_rps"`           // Changed to int64 for millions of RPS
	MinRPS           int64                `json:"min_rps"`           // Starting RPS (default: 1)
	Duration         time.Duration        `json:"duration"`
	ConcurrentUsers  int                  `json:"concurrent_users"`
	RampUpTime       time.Duration        `json:"ramp_up_time"`
	Pattern          LoadPattern          `json:"pattern"`
	ScaleMode        ScaleMode            `json:"scale_mode"`        // Linear, Logarithmic, Exponential
	SampleInterval   time.Duration        `json:"sample_interval"`   // Time-series sampling rate
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
		authManager:      NewAuthManager(),
		varResolver:      NewVariableResolver(),
		validationEngine: NewValidationEngine(),
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
	
	// Set up authentication configuration
	if config.Auth != nil {
		e.authManager.SetAuthConfig(config.ID, config.Auth)
	}
	
	// Create HTTP client with authentication support
	client, err := e.authManager.CreateHTTPClientWithAuth(config.Auth)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to create HTTP client: " + err.Error()})
		return
	}
	
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
		client: client,
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

// resolveVariables resolves dynamic variables in the simulation configuration
func (e *Engine) resolveVariables(config *SimulationConfig) *SimulationConfig {
	resolved := &SimulationConfig{
		ID:              config.ID,
		Name:            e.varResolver.Resolve(config.Name),
		TargetURL:       e.varResolver.Resolve(config.TargetURL),
		Method:          config.Method,
		Headers:         config.Headers, // Will be resolved later
		Body:            e.varResolver.ResolveBody(config.Body),
		Auth:            config.Auth,
		ContentType:     e.varResolver.Resolve(config.ContentType),
		MaxRPS:          config.MaxRPS,
		MinRPS:          config.MinRPS,
		Duration:        config.Duration,
		ConcurrentUsers: config.ConcurrentUsers,
		RampUpTime:      config.RampUpTime,
		Pattern:         config.Pattern,
		ScaleMode:       config.ScaleMode,
		SampleInterval:  config.SampleInterval,
	}
	return resolved
}

// executeRequest performs a single HTTP request
func (e *Engine) executeRequest(sim *Simulation, workerPool <-chan struct{}, wg *sync.WaitGroup) {
	defer func() {
		<-workerPool
		wg.Done()
	}()

	startTime := time.Now()
	
	// Resolve variables in configuration
	resolvedConfig := e.resolveVariables(sim.config)
	
	// Build request body
	body, contentType, err := e.buildRequestBody(resolvedConfig)
	if err != nil {
		atomic.AddInt64(&sim.errorCount, 1)
		logrus.Debugf("Failed to build request body: %v", err)
		return
	}

	// Create HTTP request with body
	req, err := http.NewRequestWithContext(sim.ctx, resolvedConfig.Method, resolvedConfig.TargetURL, body)
	if err != nil {
		atomic.AddInt64(&sim.errorCount, 1)
		return
	}

	// Set Content-Type if we have one
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}

	// Add resolved headers
	resolvedHeaders := e.varResolver.ResolveHeaders(resolvedConfig.Headers)
	for key, value := range resolvedHeaders {
		req.Header.Set(key, value)
	}

	// Apply authentication
	if err := e.authManager.ApplyAuth(req, sim.status.ID); err != nil {
		atomic.AddInt64(&sim.errorCount, 1)
		logrus.Debugf("Authentication failed: %v", err)
		return
	}

	// Execute request
	resp, err := sim.client.Do(req)
	responseTime := time.Since(startTime)
	
	atomic.AddInt64(&sim.requestCount, 1)

	if err != nil {
		atomic.AddInt64(&sim.errorCount, 1)
		// Record validation failure for network errors
		e.recordValidationResult(sim, nil, responseTime, &ValidationResult{
			Passed: false,
			Errors: []ValidationError{{
				Type:    "network",
				Message: err.Error(),
			}},
			Duration: responseTime,
		})
		logrus.Debugf("Request failed: %v", err)
		return
	}
	defer resp.Body.Close()

	// Read response body for validation
	responseBody, bodyReadErr := e.readResponseBody(resp)
	if bodyReadErr != nil {
		atomic.AddInt64(&sim.errorCount, 1)
		logrus.Debugf("Failed to read response body: %v", bodyReadErr)
		return
	}

	// Perform validation if configured
	var validationResult *ValidationResult
	if resolvedConfig.Validation != nil {
		validationResult = e.validationEngine.ValidateResponse(resp, responseBody, resolvedConfig.Validation, responseTime)
	} else {
		// Default validation (status code only)
		validationResult = &ValidationResult{
			Passed:   resp.StatusCode >= 200 && resp.StatusCode < 300,
			Duration: responseTime,
		}
		if !validationResult.Passed {
			validationResult.Errors = []ValidationError{{
				Type:     "status_code",
				Expected: "2xx",
				Actual:   fmt.Sprintf("%d", resp.StatusCode),
				Message:  fmt.Sprintf("HTTP %d response", resp.StatusCode),
			}}
		}
	}

	// Update counters based on validation results
	if validationResult.Passed {
		atomic.AddInt64(&sim.successCount, 1)
	} else {
		atomic.AddInt64(&sim.errorCount, 1)
	}

	// Record response time and validation results
	sim.mu.Lock()
	sim.responseTimes = append(sim.responseTimes, responseTime)
	sim.mu.Unlock()

	// Store validation results for reporting
	e.recordValidationResult(sim, resp, responseTime, validationResult)
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

// GetPointsSince returns all points since a given time
func (tsm *TimeSeriesMetrics) GetPointsSince(since time.Time) []TimeSeriesPoint {
	tsm.mu.RLock()
	defer tsm.mu.RUnlock()
	
	if since.IsZero() {
		// Return all points if no time specified
		result := make([]TimeSeriesPoint, len(tsm.Points))
		copy(result, tsm.Points)
		return result
	}
	
	var result []TimeSeriesPoint
	for _, point := range tsm.Points {
		if point.Timestamp.After(since) || point.Timestamp.Equal(since) {
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

	// Validate request body
	if err := e.validateBody(config); err != nil {
		return fmt.Errorf("body validation failed: %v", err)
	}

	// Validate authentication configuration
	if config.Auth != nil {
		if err := e.validateAuth(config.Auth); err != nil {
			return fmt.Errorf("auth validation failed: %v", err)
		}
	}

	// Validate response validation configuration
	if config.Validation != nil {
		if err := e.validateValidationConfig(config.Validation); err != nil {
			return fmt.Errorf("validation config failed: %v", err)
		}
	}

	return nil
}

// validateAuth validates authentication configuration
func (e *Engine) validateAuth(auth *AuthConfig) error {
	switch auth.Type {
	case AuthTypeNone:
		return nil
		
	case AuthTypeBearer:
		if auth.BearerToken == nil || auth.BearerToken.Token == "" {
			return fmt.Errorf("bearer token is required")
		}
		
	case AuthTypeBasic:
		if auth.BasicAuth == nil || auth.BasicAuth.Username == "" || auth.BasicAuth.Password == "" {
			return fmt.Errorf("username and password are required for basic auth")
		}
		
	case AuthTypeAPIKey:
		if auth.APIKey == nil || auth.APIKey.Key == "" || auth.APIKey.Value == "" {
			return fmt.Errorf("API key name and value are required")
		}
		if auth.APIKey.Location != "header" && auth.APIKey.Location != "query" {
			return fmt.Errorf("API key location must be 'header' or 'query'")
		}
		
	case AuthTypeJWT:
		if auth.JWT == nil || auth.JWT.Token == "" {
			return fmt.Errorf("JWT token is required")
		}
		
	case AuthTypeOAuth2:
		if auth.OAuth2 == nil || auth.OAuth2.ClientID == "" || auth.OAuth2.ClientSecret == "" || auth.OAuth2.TokenURL == "" {
			return fmt.Errorf("OAuth2 client credentials and token URL are required")
		}
		
	case AuthTypeClientCert:
		if auth.ClientCert == nil || auth.ClientCert.CertFile == "" || auth.ClientCert.KeyFile == "" {
			return fmt.Errorf("client certificate and key files are required")
		}
		
	default:
		return fmt.Errorf("unsupported auth type: %s", auth.Type)
	}
	
	return nil
}

// validateValidationConfig validates response validation configuration
func (e *Engine) validateValidationConfig(validation *ResponseValidation) error {
	// Validate custom assertions
	if len(validation.Assertions) > 0 {
		for _, assertion := range validation.Assertions {
			if assertion.Name == "" {
				return fmt.Errorf("assertion name is required")
			}
			if assertion.Script == "" {
				return fmt.Errorf("assertion script is required for '%s'", assertion.Name)
			}
			
			// Validate assertion syntax
			if err := e.validationEngine.assertionEngine.ValidateAssertion(&assertion); err != nil {
				return fmt.Errorf("assertion '%s' has invalid syntax: %v", assertion.Name, err)
			}
		}
	}

	// Validate body validation configuration
	if validation.Body != nil {
		if validation.Body.Type == "" {
			return fmt.Errorf("body validation type is required")
		}
		
		// Validate regex patterns
		for _, regex := range validation.Body.Regex {
			if regex.Pattern == "" {
				return fmt.Errorf("regex pattern is required")
			}
			if _, err := regexp.Compile(regex.Pattern); err != nil {
				return fmt.Errorf("invalid regex pattern '%s': %v", regex.Pattern, err)
			}
		}
		
		// Validate size constraints
		if validation.Body.Size != nil {
			if validation.Body.Size.Min != nil && *validation.Body.Size.Min < 0 {
				return fmt.Errorf("minimum body size cannot be negative")
			}
			if validation.Body.Size.Max != nil && *validation.Body.Size.Max < 0 {
				return fmt.Errorf("maximum body size cannot be negative")
			}
			if validation.Body.Size.Min != nil && validation.Body.Size.Max != nil {
				if *validation.Body.Size.Min > *validation.Body.Size.Max {
					return fmt.Errorf("minimum body size cannot be greater than maximum")
				}
			}
		}

		// Validate JSONPath expressions (basic validation)
		for _, jsonPath := range validation.Body.JSONPath {
			if jsonPath.Path == "" {
				return fmt.Errorf("JSONPath expression is required")
			}
			if jsonPath.Operator == "" {
				return fmt.Errorf("JSONPath operator is required for path '%s'", jsonPath.Path)
			}
			// Validate operator
			validOperators := []string{"equals", "not_equals", "contains", "gt", "lt", "gte", "lte", "exists"}
			validOperator := false
			for _, op := range validOperators {
				if jsonPath.Operator == op {
					validOperator = true
					break
				}
			}
			if !validOperator {
				return fmt.Errorf("invalid JSONPath operator '%s' for path '%s'", jsonPath.Operator, jsonPath.Path)
			}
		}
	}

	// Validate response time thresholds
	if validation.ResponseTime != nil {
		if validation.ResponseTime.MaxResponseTime <= 0 {
			return fmt.Errorf("maximum response time must be positive")
		}
		if validation.ResponseTime.P95Threshold != 0 && validation.ResponseTime.P95Threshold <= 0 {
			return fmt.Errorf("P95 threshold must be positive")
		}
		if validation.ResponseTime.P99Threshold != 0 && validation.ResponseTime.P99Threshold <= 0 {
			return fmt.Errorf("P99 threshold must be positive")
		}
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
	var simulations []map[string]interface{}
	
	// Get active simulations
	e.activeSimulations.Range(func(key, value interface{}) bool {
		sim := value.(*Simulation)
		simData := map[string]interface{}{
			"id":               sim.status.ID,
			"name":            sim.status.Name,
			"status":          sim.status.Status,
			"start_time":      sim.status.StartTime,
			"total_requests":  sim.status.TotalRequests,
			"successful_reqs": sim.status.SuccessfulReqs,
			"failed_requests": sim.status.FailedRequests,
			"current_rps":     sim.status.CurrentRPS,
			"config":          sim.config,
		}
		simulations = append(simulations, simData)
		return true
	})
	
	c.JSON(http.StatusOK, gin.H{
		"simulations": simulations,
		"total":       len(simulations),
	})
}

func (e *Engine) GetSimulation(c *gin.Context) {
	simulationID := c.Param("id")
	
	if simValue, exists := e.activeSimulations.Load(simulationID); exists {
		sim := simValue.(*Simulation)
		
		// Get time-series data
		timeSeriesPoints := sim.timeSeries.GetPointsSince(time.Time{})
		
		simData := map[string]interface{}{
			"id":               sim.status.ID,
			"name":            sim.status.Name,
			"status":          sim.status.Status,
			"start_time":      sim.status.StartTime,
			"total_requests":  sim.status.TotalRequests,
			"successful_reqs": sim.status.SuccessfulReqs,
			"failed_requests": sim.status.FailedRequests,
			"current_rps":     sim.status.CurrentRPS,
			"config":          sim.config,
			"time_series":     timeSeriesPoints,
			"response_times":  sim.status.ResponseTimes,
		}
		
		c.JSON(http.StatusOK, simData)
		return
	}
	
	c.JSON(http.StatusNotFound, gin.H{"error": "Simulation not found"})
}

func (e *Engine) StopSimulation(c *gin.Context) {
	simulationID := c.Param("id")
	
	if simValue, exists := e.activeSimulations.Load(simulationID); exists {
		sim := simValue.(*Simulation)
		
		// Cancel the simulation context
		sim.cancel()
		
		// Update status
		sim.mu.Lock()
		sim.status.Status = "stopped"
		endTime := time.Now()
		sim.status.EndTime = &endTime
		sim.mu.Unlock()
		
		// Remove from active simulations
		e.activeSimulations.Delete(simulationID)
		
		// Broadcast stop event
		e.wsHub.Broadcast("simulation_stopped", gin.H{
			"simulation_id": simulationID,
			"status":        "stopped",
			"end_time":      endTime,
		})
		
		c.JSON(http.StatusOK, gin.H{
			"message":       "Simulation stopped successfully",
			"simulation_id": simulationID,
			"status":        "stopped",
		})
		return
	}
	
	c.JSON(http.StatusNotFound, gin.H{"error": "Simulation not found"})
}

func (e *Engine) DeleteSimulation(c *gin.Context) {
	simulationID := c.Param("id")
	
	// First try to stop if running
	if simValue, exists := e.activeSimulations.Load(simulationID); exists {
		sim := simValue.(*Simulation)
		sim.cancel()
		e.activeSimulations.Delete(simulationID)
	}
	
	// TODO: Delete from database if implemented
	// db.Where("id = ?", simulationID).Delete(&Simulation{})
	
	c.JSON(http.StatusOK, gin.H{
		"message":       "Simulation deleted successfully",
		"simulation_id": simulationID,
	})
}

func (e *Engine) GetConfigurations(c *gin.Context) {
	// Return predefined configuration templates
	configurations := map[string]SimulationConfig{
		"light_load": {
			Name:             "Light Load Test",
			MinRPS:           1,
			MaxRPS:           100,
			Duration:         2 * time.Minute,
			ConcurrentUsers:  10,
			Pattern:          PatternLinearRamp,
			ScaleMode:        ScaleModeLinear,
			SampleInterval:   1 * time.Second,
		},
		"medium_load": {
			Name:             "Medium Load Test",
			MinRPS:           10,
			MaxRPS:           1000,
			Duration:         5 * time.Minute,
			ConcurrentUsers:  50,
			Pattern:          PatternLinearRamp,
			ScaleMode:        ScaleModeLinear,
			SampleInterval:   1 * time.Second,
		},
		"heavy_load": {
			Name:             "Heavy Load Test",
			MinRPS:           100,
			MaxRPS:           10000,
			Duration:         10 * time.Minute,
			ConcurrentUsers:  500,
			Pattern:          PatternExponential,
			ScaleMode:        ScaleModeExponential,
			SampleInterval:   500 * time.Millisecond,
		},
		"stress_test": {
			Name:             "Stress Test",
			MinRPS:           1000,
			MaxRPS:           50000,
			Duration:         15 * time.Minute,
			ConcurrentUsers:  2000,
			Pattern:          PatternMegaScale,
			ScaleMode:        ScaleModeLogarithmic,
			SampleInterval:   500 * time.Millisecond,
		},
	}
	
	c.JSON(http.StatusOK, configurations)
}

func (e *Engine) SaveConfiguration(c *gin.Context) {
	var config SimulationConfig
	if err := c.ShouldBindJSON(&config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid configuration: " + err.Error()})
		return
	}
	
	// Validate configuration
	if err := e.validateConfig(&config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Configuration validation failed: " + err.Error()})
		return
	}
	
	// TODO: Save to database in production
	// For now, just return success
	c.JSON(http.StatusCreated, gin.H{
		"message": "Configuration saved successfully",
		"config":  config,
	})
}

func (e *Engine) GetServiceProfiles(c *gin.Context) {
	// Return Origo Stack service profiles for testing
	serviceProfiles := map[string]interface{}{
		"auth_service": map[string]interface{}{
			"name":        "Authentication Service (Java)",
			"technology":  "Spring Boot",
			"base_url":    "http://localhost:8081",
			"endpoints": []map[string]string{
				{"path": "/api/auth/login", "method": "POST"},
				{"path": "/api/auth/validate", "method": "GET"},
				{"path": "/api/auth/refresh", "method": "POST"},
				{"path": "/api/users/profile", "method": "GET"},
			},
			"expected_rps":        12000,
			"expected_p95_latency": "150ms",
			"characteristics": map[string]string{
				"type":        "CPU-intensive",
				"bottleneck":  "JWT processing",
				"scaling":     "Horizontal",
			},
		},
		"control_plane": map[string]interface{}{
			"name":        "Control Plane Service (Go)",
			"technology":  "Go + Gin",
			"base_url":    "http://localhost:8082",
			"endpoints": []map[string]string{
				{"path": "/api/rooms", "method": "GET"},
				{"path": "/api/rooms", "method": "POST"},
				{"path": "/api/rooms/{id}/join", "method": "POST"},
				{"path": "/api/rooms/{id}/leave", "method": "POST"},
			},
			"expected_rps":        45000,
			"expected_p95_latency": "50ms",
			"characteristics": map[string]string{
				"type":        "High-throughput",
				"bottleneck":  "Database connections",
				"scaling":     "Horizontal + Vertical",
			},
		},
		"chat_service": map[string]interface{}{
			"name":        "Chat Service (Go)",
			"technology":  "Go + NATS",
			"base_url":    "http://localhost:8083",
			"endpoints": []map[string]string{
				{"path": "/api/chat/messages", "method": "GET"},
				{"path": "/api/chat/messages", "method": "POST"},
				{"path": "/api/chat/rooms/{id}/messages", "method": "GET"},
				{"path": "/api/chat/presence", "method": "GET"},
			},
			"expected_rps":        40000,
			"expected_p95_latency": "30ms",
			"characteristics": map[string]string{
				"type":        "Real-time messaging",
				"bottleneck":  "Message queue throughput",
				"scaling":     "Horizontal",
			},
		},
		"notification_service": map[string]interface{}{
			"name":        "Notification Service (Go)",
			"technology":  "Go + Gin",
			"base_url":    "http://localhost:8084",
			"endpoints": []map[string]string{
				{"path": "/api/notifications/send", "method": "POST"},
				{"path": "/api/notifications/bulk", "method": "POST"},
				{"path": "/api/notifications/webhook", "method": "POST"},
				{"path": "/api/notifications/status", "method": "GET"},
			},
			"expected_rps":        35000,
			"expected_p95_latency": "80ms",
			"characteristics": map[string]string{
				"type":        "I/O intensive",
				"bottleneck":  "External API calls",
				"scaling":     "Horizontal",
			},
		},
		"billing_service": map[string]interface{}{
			"name":        "Billing Service (Java)",
			"technology":  "Spring Boot + JPA",
			"base_url":    "http://localhost:8085",
			"endpoints": []map[string]string{
				{"path": "/api/billing/usage", "method": "POST"},
				{"path": "/api/billing/plans", "method": "GET"},
				{"path": "/api/billing/invoices", "method": "GET"},
				{"path": "/api/billing/payment", "method": "POST"},
			},
			"expected_rps":        15000,
			"expected_p95_latency": "200ms",
			"characteristics": map[string]string{
				"type":        "Transaction-heavy",
				"bottleneck":  "Database transactions",
				"scaling":     "Vertical + Database optimization",
			},
		},
	}
	
	c.JSON(http.StatusOK, gin.H{
		"service_profiles": serviceProfiles,
		"total":           len(serviceProfiles),
	})
}

func (e *Engine) CreateServiceProfile(c *gin.Context) {
	var profile map[string]interface{}
	if err := c.ShouldBindJSON(&profile); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid service profile: " + err.Error()})
		return
	}
	
	// Validate required fields
	requiredFields := []string{"name", "technology", "base_url"}
	for _, field := range requiredFields {
		if _, exists := profile[field]; !exists {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Missing required field: %s", field)})
			return
		}
	}
	
	// TODO: Save to database in production
	// For now, just return success
	c.JSON(http.StatusCreated, gin.H{
		"message": "Service profile created successfully",
		"profile": profile,
	})
}

// TestConnection tests connectivity to a target URL with authentication
func (e *Engine) TestConnection(c *gin.Context) {
	var testConfig struct {
		TargetURL string     `json:"target_url"`
		Method    string     `json:"method"`
		Headers   map[string]string `json:"headers"`
		Auth      *AuthConfig `json:"auth"`
		Timeout   int        `json:"timeout"`
	}

	if err := c.ShouldBindJSON(&testConfig); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid test configuration: " + err.Error()})
		return
	}

	// Set defaults
	if testConfig.Method == "" {
		testConfig.Method = "GET"
	}
	if testConfig.Timeout == 0 {
		testConfig.Timeout = 10
	}

	// Create HTTP client with authentication
	client, err := e.authManager.CreateHTTPClientWithAuth(testConfig.Auth)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Failed to create HTTP client: " + err.Error(),
		})
		return
	}

	// Set timeout
	client.Timeout = time.Duration(testConfig.Timeout) * time.Second

	startTime := time.Now()

	// Create request
	req, err := http.NewRequest(testConfig.Method, testConfig.TargetURL, nil)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"error":   "Failed to create request: " + err.Error(),
		})
		return
	}

	// Add headers
	for key, value := range testConfig.Headers {
		req.Header.Set(key, value)
	}

	// Apply authentication (using a temporary simulation ID)
	tempSimID := int64(99999)
	if testConfig.Auth != nil {
		e.authManager.SetAuthConfig(tempSimID, testConfig.Auth)
		if err := e.authManager.ApplyAuth(req, tempSimID); err != nil {
			e.authManager.ClearAuthConfig(tempSimID)
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"error":   "Authentication failed: " + err.Error(),
			})
			return
		}
	}

	// Execute request
	resp, err := client.Do(req)
	responseTime := time.Since(startTime)

	// Clean up temporary auth config
	if testConfig.Auth != nil {
		e.authManager.ClearAuthConfig(tempSimID)
	}

	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success":      false,
			"error":        err.Error(),
			"responseTime": responseTime.String(),
		})
		return
	}
	defer resp.Body.Close()

	// Read response body (limited)
	bodyBytes := make([]byte, 1024)
	n, _ := resp.Body.Read(bodyBytes)
	responseBody := string(bodyBytes[:n])

	c.JSON(http.StatusOK, gin.H{
		"success":      true,
		"statusCode":   resp.StatusCode,
		"responseTime": responseTime.String(),
		"responseSize": len(responseBody),
		"headers":      resp.Header,
		"preview":      responseBody,
	})
}

// TestAuth tests authentication configuration
func (e *Engine) TestAuth(c *gin.Context) {
	var testConfig struct {
		AuthType  string     `json:"auth_type"`
		TargetURL string     `json:"target_url"`
		Config    *AuthConfig `json:"config"`
	}

	if err := c.ShouldBindJSON(&testConfig); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid test configuration: " + err.Error()})
		return
	}

	if testConfig.TargetURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Target URL is required for auth testing"})
		return
	}

	// Validate auth config
	if err := e.validateAuth(testConfig.Config); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"error":   "Auth validation failed: " + err.Error(),
		})
		return
	}

	// Create HTTP client with authentication
	client, err := e.authManager.CreateHTTPClientWithAuth(testConfig.Config)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"error":   "Failed to create HTTP client: " + err.Error(),
		})
		return
	}

	client.Timeout = 10 * time.Second

	// Create test request
	req, err := http.NewRequest("GET", testConfig.TargetURL, nil)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"error":   "Failed to create request: " + err.Error(),
		})
		return
	}

	// Apply authentication (using a temporary simulation ID)
	tempSimID := int64(99998)
	e.authManager.SetAuthConfig(tempSimID, testConfig.Config)
	
	if err := e.authManager.ApplyAuth(req, tempSimID); err != nil {
		e.authManager.ClearAuthConfig(tempSimID)
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"error":   "Authentication failed: " + err.Error(),
		})
		return
	}

	// Execute request
	startTime := time.Now()
	resp, err := client.Do(req)
	responseTime := time.Since(startTime)

	// Clean up temporary auth config
	e.authManager.ClearAuthConfig(tempSimID)

	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success":      false,
			"error":        err.Error(),
			"responseTime": responseTime.String(),
		})
		return
	}
	defer resp.Body.Close()

	c.JSON(http.StatusOK, gin.H{
		"success":      true,
		"statusCode":   resp.StatusCode,
		"responseTime": responseTime.String(),
		"message":      fmt.Sprintf("Authentication successful (Status: %d)", resp.StatusCode),
	})
}

// GetAvailableVariables returns all available dynamic variables
func (e *Engine) GetAvailableVariables(c *gin.Context) {
	variables := e.varResolver.GetAvailableVariables()
	
	c.JSON(http.StatusOK, gin.H{
		"variables": variables,
		"total":     len(variables),
		"examples": map[string]string{
			"Basic usage":     "{{username}} will be replaced with a random username",
			"In JSON body":    `{"name": "{{full_name}}", "email": "{{email}}"}`,
			"In headers":      "X-Request-ID: {{uuid}}",
			"Multiple vars":   "User {{username}} created at {{timestamp}}",
		},
	})
}

// readResponseBody reads the response body with size limits
func (e *Engine) readResponseBody(resp *http.Response) ([]byte, error) {
	// Limit response body size to prevent memory issues (10MB max)
	const maxBodySize = 10 * 1024 * 1024
	limitedReader := io.LimitReader(resp.Body, maxBodySize)
	return io.ReadAll(limitedReader)
}

// recordValidationResult stores validation results for reporting and real-time monitoring
func (e *Engine) recordValidationResult(sim *Simulation, resp *http.Response, responseTime time.Duration, validation *ValidationResult) {
	// Create validation record
	record := ValidationRecord{
		SimulationID:     sim.config.ID,
		Timestamp:        time.Now(),
		ResponseTime:     responseTime,
		ValidationResult: validation,
	}

	if resp != nil {
		record.StatusCode = resp.StatusCode
	}

	// Store validation results in memory for this simulation
	key := fmt.Sprintf("validation-%d", sim.config.ID)
	if existing, ok := e.validationResults.Load(key); ok {
		if records, ok := existing.([]ValidationRecord); ok {
			// Keep only the last 1000 validation records per simulation to prevent memory bloat
			if len(records) >= 1000 {
				records = records[len(records)-999:]
			}
			records = append(records, record)
			e.validationResults.Store(key, records)
		}
	} else {
		e.validationResults.Store(key, []ValidationRecord{record})
	}

	// Broadcast validation failures via WebSocket for real-time monitoring
	if !validation.Passed {
		e.wsHub.Broadcast("validation_failure", map[string]interface{}{
			"simulation_id": sim.config.ID,
			"timestamp":     record.Timestamp,
			"errors":        validation.Errors,
			"response_time": responseTime.String(),
			"status_code":   record.StatusCode,
		})
	}

	// Log validation failures for debugging
	if !validation.Passed {
		logrus.Debugf("Validation failed for simulation %d: %d errors", sim.config.ID, len(validation.Errors))
		for _, err := range validation.Errors {
			logrus.Debugf("  - %s: %s", err.Type, err.Message)
		}
	}
}

// GetValidationResults returns validation results for a simulation
func (e *Engine) GetValidationResults(c *gin.Context) {
	simulationID := c.Param("id")
	key := fmt.Sprintf("validation-%s", simulationID)
	
	if results, ok := e.validationResults.Load(key); ok {
		if records, ok := results.([]ValidationRecord); ok {
			c.JSON(http.StatusOK, gin.H{
				"simulation_id": simulationID,
				"total_records": len(records),
				"results":       records,
			})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"simulation_id": simulationID,
		"total_records": 0,
		"results":       []ValidationRecord{},
	})
}

// TestValidation tests validation rules against a sample response
func (e *Engine) TestValidation(c *gin.Context) {
	var testRequest struct {
		Validation *ResponseValidation `json:"validation"`
		TestData   struct {
			StatusCode int               `json:"status_code"`
			Headers    map[string]string `json:"headers"`
			Body       string            `json:"body"`
		} `json:"test_data"`
	}

	if err := c.ShouldBindJSON(&testRequest); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid test request: " + err.Error()})
		return
	}

	if testRequest.Validation == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation configuration is required"})
		return
	}

	// Create mock HTTP response
	mockResp := &http.Response{
		StatusCode: testRequest.TestData.StatusCode,
		Header:     make(http.Header),
		Status:     fmt.Sprintf("%d %s", testRequest.TestData.StatusCode, http.StatusText(testRequest.TestData.StatusCode)),
	}

	// Set headers
	for key, value := range testRequest.TestData.Headers {
		mockResp.Header.Set(key, value)
	}

	// Test validation
	testResponseTime := 100 * time.Millisecond // Mock response time
	result := e.validationEngine.ValidateResponse(
		mockResp,
		[]byte(testRequest.TestData.Body),
		testRequest.Validation,
		testResponseTime,
	)

	c.JSON(http.StatusOK, gin.H{
		"validation_result": result,
		"test_passed":       result.Passed,
		"error_count":       len(result.Errors),
		"warning_count":     len(result.Warnings),
	})
}
