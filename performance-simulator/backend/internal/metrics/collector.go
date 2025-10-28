package metrics

import (
	"fmt"
	"math"
	"net/http"
	"sort"
	"time"

	"github.com/gin-gonic/gin"
)

// Collector manages performance metrics collection and analysis
type Collector struct {
	data map[int64]*SimulationMetrics
}

// SimulationMetrics holds comprehensive performance data for a simulation
type SimulationMetrics struct {
	SimulationID    int64                    `json:"simulation_id"`
	StartTime       time.Time                `json:"start_time"`
	EndTime         *time.Time               `json:"end_time,omitempty"`
	TotalRequests   int64                    `json:"total_requests"`
	SuccessfulReqs  int64                    `json:"successful_requests"`
	FailedRequests  int64                    `json:"failed_requests"`
	ResponseTimes   *ResponseTimes           `json:"response_times"`
	ThroughputData  []ThroughputPoint        `json:"throughput_data"`
	ErrorRates      []ErrorRatePoint         `json:"error_rates"`
	ResourceUsage   *ResourceUsage           `json:"resource_usage"`
}

// ResponseTimes contains response time statistics
type ResponseTimes struct {
	Min         time.Duration `json:"min"`
	Max         time.Duration `json:"max"`
	Mean        time.Duration `json:"mean"`
	Median      time.Duration `json:"median"`
	P95         time.Duration `json:"p95"`
	P99         time.Duration `json:"p99"`
	StdDev      time.Duration `json:"std_dev"`
}

// ThroughputPoint represents throughput at a specific time
type ThroughputPoint struct {
	Timestamp time.Time `json:"timestamp"`
	RPS       float64   `json:"rps"`
}

// ErrorRatePoint represents error rate at a specific time
type ErrorRatePoint struct {
	Timestamp time.Time `json:"timestamp"`
	ErrorRate float64   `json:"error_rate"`
	ErrorCode int       `json:"error_code,omitempty"`
}

// ResourceUsage contains system resource utilization data
type ResourceUsage struct {
	CPUPercent    float64 `json:"cpu_percent"`
	MemoryPercent float64 `json:"memory_percent"`
	NetworkTX     int64   `json:"network_tx"`
	NetworkRX     int64   `json:"network_rx"`
}

// PerformanceComparison compares multiple services/simulations
type PerformanceComparison struct {
	Services []ServicePerformance `json:"services"`
	Summary  *ComparisonSummary   `json:"summary"`
}

// ServicePerformance contains performance data for a specific service
type ServicePerformance struct {
	Name          string         `json:"name"`
	Technology    string         `json:"technology"`
	MaxRPS        float64        `json:"max_rps"`
	AvgLatency    time.Duration  `json:"avg_latency"`
	P95Latency    time.Duration  `json:"p95_latency"`
	ErrorRate     float64        `json:"error_rate"`
	ResponseTimes *ResponseTimes `json:"response_times"`
}

// ComparisonSummary provides high-level comparison insights
type ComparisonSummary struct {
	BestPerformer    string  `json:"best_performer"`
	PerformanceGap   float64 `json:"performance_gap"`
	Recommendation   string  `json:"recommendation"`
}

// NewCollector creates a new metrics collector
func NewCollector() *Collector {
	return &Collector{
		data: make(map[int64]*SimulationMetrics),
	}
}

// RecordMetrics stores performance data for a simulation
func (c *Collector) RecordMetrics(simulationID int64, metrics *SimulationMetrics) {
	c.data[simulationID] = metrics
}

// GetLiveMetrics returns real-time metrics for active simulations
func (c *Collector) GetLiveMetrics(ctx *gin.Context) {
	// This would return real-time metrics from active simulations
	// For now, returning mock data structure
	ctx.JSON(http.StatusOK, gin.H{
		"active_simulations": len(c.data),
		"message":           "Live metrics endpoint",
	})
}

// GetHistoricalMetrics returns historical performance data
func (c *Collector) GetHistoricalMetrics(ctx *gin.Context) {
	simulationID := ctx.Param("simulationId")
	
	// Implementation would retrieve from database
	ctx.JSON(http.StatusOK, gin.H{
		"simulation_id": simulationID,
		"message":      "Historical metrics endpoint",
	})
}

// CalculatePercentiles computes response time percentiles from raw data
func CalculatePercentiles(responseTimes []time.Duration) *ResponseTimes {
	if len(responseTimes) == 0 {
		return &ResponseTimes{}
	}

	// Sort response times
	sorted := make([]time.Duration, len(responseTimes))
	copy(sorted, responseTimes)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i] < sorted[j]
	})

	// Calculate basic statistics
	min := sorted[0]
	max := sorted[len(sorted)-1]
	
	// Calculate mean
	var sum time.Duration
	for _, rt := range sorted {
		sum += rt
	}
	mean := time.Duration(int64(sum) / int64(len(sorted)))

	// Calculate percentiles
	median := percentile(sorted, 50)
	p95 := percentile(sorted, 95)
	p99 := percentile(sorted, 99)

	// Calculate standard deviation
	stdDev := calculateStdDev(sorted, mean)

	return &ResponseTimes{
		Min:    min,
		Max:    max,
		Mean:   mean,
		Median: median,
		P95:    p95,
		P99:    p99,
		StdDev: stdDev,
	}
}

// percentile calculates the nth percentile from sorted data
func percentile(sorted []time.Duration, n int) time.Duration {
	if len(sorted) == 0 {
		return 0
	}
	
	index := float64(n) / 100.0 * float64(len(sorted)-1)
	lower := int(math.Floor(index))
	upper := int(math.Ceil(index))
	
	if lower == upper {
		return sorted[lower]
	}
	
	// Linear interpolation
	weight := index - float64(lower)
	return time.Duration(float64(sorted[lower]) + weight*float64(sorted[upper]-sorted[lower]))
}

// calculateStdDev computes standard deviation of response times
func calculateStdDev(data []time.Duration, mean time.Duration) time.Duration {
	if len(data) <= 1 {
		return 0
	}

	var sum float64
	for _, value := range data {
		diff := float64(value - mean)
		sum += diff * diff
	}

	variance := sum / float64(len(data)-1)
	return time.Duration(math.Sqrt(variance))
}

// CompareServices analyzes performance differences between services
func (c *Collector) CompareServices(services []ServicePerformance) *PerformanceComparison {
	if len(services) == 0 {
		return &PerformanceComparison{}
	}

	// Find best performer (highest RPS with acceptable latency)
	bestPerformer := services[0]
	for _, service := range services[1:] {
		if service.MaxRPS > bestPerformer.MaxRPS && 
		   service.P95Latency < 2*bestPerformer.P95Latency {
			bestPerformer = service
		}
	}

	// Calculate performance gap
	var totalRPS float64
	for _, service := range services {
		totalRPS += service.MaxRPS
	}
	avgRPS := totalRPS / float64(len(services))
	performanceGap := (bestPerformer.MaxRPS - avgRPS) / avgRPS * 100

	// Generate recommendation
	recommendation := generateRecommendation(bestPerformer, performanceGap)

	return &PerformanceComparison{
		Services: services,
		Summary: &ComparisonSummary{
			BestPerformer:  bestPerformer.Name,
			PerformanceGap: performanceGap,
			Recommendation: recommendation,
		},
	}
}

// generateRecommendation creates performance optimization suggestions
func generateRecommendation(bestPerformer ServicePerformance, gap float64) string {
	if gap > 50 {
		return fmt.Sprintf("Consider migrating services to %s (%s) for significant performance gains. Performance improvement potential: %.1f%%",
			bestPerformer.Name, bestPerformer.Technology, gap)
	} else if gap > 20 {
		return fmt.Sprintf("%s (%s) shows better performance. Consider optimization or migration for critical services.",
			bestPerformer.Name, bestPerformer.Technology)
	}
	return "Performance differences are minimal. Current architecture choices are reasonable."
}

// GenerateReport creates a comprehensive performance report
func (c *Collector) GenerateReport(simulationIDs []int64) *PerformanceReport {
	report := &PerformanceReport{
		GeneratedAt:   time.Now(),
		Simulations:   make([]SimulationSummary, 0, len(simulationIDs)),
		Insights:      make([]string, 0),
		Recommendations: make([]string, 0),
	}

	// Aggregate data from multiple simulations
	for _, id := range simulationIDs {
		if metrics, exists := c.data[id]; exists {
			summary := c.createSimulationSummary(metrics)
			report.Simulations = append(report.Simulations, summary)
		}
	}

	// Generate insights and recommendations
	report.Insights = c.generateInsights(report.Simulations)
	report.Recommendations = c.generateOptimizationRecommendations(report.Simulations)

	return report
}

// PerformanceReport contains comprehensive analysis results
type PerformanceReport struct {
	GeneratedAt     time.Time           `json:"generated_at"`
	Simulations     []SimulationSummary `json:"simulations"`
	Insights        []string            `json:"insights"`
	Recommendations []string            `json:"recommendations"`
}

// SimulationSummary provides key metrics for a simulation
type SimulationSummary struct {
	Name           string        `json:"name"`
	Duration       time.Duration `json:"duration"`
	TotalRequests  int64         `json:"total_requests"`
	AverageRPS     float64       `json:"average_rps"`
	SuccessRate    float64       `json:"success_rate"`
	AvgResponseTime time.Duration `json:"avg_response_time"`
	P95ResponseTime time.Duration `json:"p95_response_time"`
}

// createSimulationSummary creates a summary from detailed metrics
func (c *Collector) createSimulationSummary(metrics *SimulationMetrics) SimulationSummary {
	duration := time.Since(metrics.StartTime)
	if metrics.EndTime != nil {
		duration = metrics.EndTime.Sub(metrics.StartTime)
	}

	successRate := float64(metrics.SuccessfulReqs) / float64(metrics.TotalRequests) * 100
	avgRPS := float64(metrics.TotalRequests) / duration.Seconds()

	return SimulationSummary{
		Name:            fmt.Sprintf("Simulation-%d", metrics.SimulationID),
		Duration:        duration,
		TotalRequests:   metrics.TotalRequests,
		AverageRPS:      avgRPS,
		SuccessRate:     successRate,
		AvgResponseTime: metrics.ResponseTimes.Mean,
		P95ResponseTime: metrics.ResponseTimes.P95,
	}
}

// generateInsights analyzes patterns in performance data
func (c *Collector) generateInsights(summaries []SimulationSummary) []string {
	insights := make([]string, 0)

	if len(summaries) == 0 {
		return insights
	}

	// Analyze RPS patterns
	var totalRPS float64
	var maxRPS float64
	for _, summary := range summaries {
		totalRPS += summary.AverageRPS
		if summary.AverageRPS > maxRPS {
			maxRPS = summary.AverageRPS
		}
	}
	avgRPS := totalRPS / float64(len(summaries))

	insights = append(insights, fmt.Sprintf("Average throughput across simulations: %.0f RPS", avgRPS))
	insights = append(insights, fmt.Sprintf("Peak throughput achieved: %.0f RPS", maxRPS))

	// Analyze response times
	var totalP95 time.Duration
	for _, summary := range summaries {
		totalP95 += summary.P95ResponseTime
	}
	avgP95 := time.Duration(int64(totalP95) / int64(len(summaries)))
	
	insights = append(insights, fmt.Sprintf("Average P95 response time: %v", avgP95))

	return insights
}

// generateOptimizationRecommendations provides actionable performance advice
func (c *Collector) generateOptimizationRecommendations(summaries []SimulationSummary) []string {
	recommendations := make([]string, 0)

	// Analyze success rates
	for _, summary := range summaries {
		if summary.SuccessRate < 95.0 {
			recommendations = append(recommendations, 
				fmt.Sprintf("Simulation '%s' has low success rate (%.1f%%). Consider investigating error causes.", 
					summary.Name, summary.SuccessRate))
		}
	}

	// Analyze response times
	for _, summary := range summaries {
		if summary.P95ResponseTime > 2*time.Second {
			recommendations = append(recommendations, 
				fmt.Sprintf("Simulation '%s' has high P95 latency (%v). Consider performance optimization.", 
					summary.Name, summary.P95ResponseTime))
		}
	}

	if len(recommendations) == 0 {
		recommendations = append(recommendations, "Performance metrics are within acceptable ranges.")
	}

	return recommendations
}
