package metrics_test

import (
	"testing"
	"time"

	"github.com/origo-stack/performance-simulator/internal/metrics"
)

func TestNewCollector(t *testing.T) {
	collector := metrics.NewCollector()
	if collector == nil {
		t.Error("NewCollector should return a valid collector instance")
	}
}

func TestCalculatePercentiles(t *testing.T) {
	tests := []struct {
		name         string
		responseTimes []time.Duration
		expectNil    bool
	}{
		{
			name:         "empty slice",
			responseTimes: []time.Duration{},
			expectNil:    false,
		},
		{
			name: "single value",
			responseTimes: []time.Duration{
				100 * time.Millisecond,
			},
			expectNil: false,
		},
		{
			name: "multiple values",
			responseTimes: []time.Duration{
				50 * time.Millisecond,
				100 * time.Millisecond,
				150 * time.Millisecond,
				200 * time.Millisecond,
				250 * time.Millisecond,
			},
			expectNil: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := metrics.CalculatePercentiles(tt.responseTimes)
			
			if tt.expectNil && result != nil {
				t.Errorf("Expected nil result, got %v", result)
			}
			
			if !tt.expectNil && result == nil {
				t.Error("Expected non-nil result, got nil")
			}
			
			if result != nil && len(tt.responseTimes) > 0 {
				if result.Min <= 0 && len(tt.responseTimes) > 0 {
					t.Error("Min response time should be greater than 0 for non-empty input")
				}
				
				if result.Max < result.Min && len(tt.responseTimes) > 1 {
					t.Error("Max response time should be greater than or equal to Min")
				}
			}
		})
	}
}

func TestCollectorRecordMetrics(t *testing.T) {
	collector := metrics.NewCollector()
	
	testMetrics := &metrics.SimulationMetrics{
		SimulationID:   1,
		StartTime:      time.Now(),
		TotalRequests:  100,
		SuccessfulReqs: 95,
		FailedRequests: 5,
	}
	
	// This should not panic
	collector.RecordMetrics(1, testMetrics)
	
	// Test passes if no panic occurs
}

func TestCompareServices(t *testing.T) {
	collector := metrics.NewCollector()
	
	services := []metrics.ServicePerformance{
		{
			Name:         "Go Service",
			Technology:   "Go",
			MaxRPS:       45000,
			AvgLatency:   50 * time.Millisecond,
			P95Latency:   100 * time.Millisecond,
			ErrorRate:    0.1,
		},
		{
			Name:         "Java Service",
			Technology:   "Java",
			MaxRPS:       12000,
			AvgLatency:   80 * time.Millisecond,
			P95Latency:   150 * time.Millisecond,
			ErrorRate:    0.2,
		},
	}
	
	comparison := collector.CompareServices(services)
	
	if comparison == nil {
		t.Error("CompareServices should return a valid comparison")
	}
	
	if comparison.Summary == nil {
		t.Error("Comparison should have a summary")
	}
	
	if len(comparison.Services) != len(services) {
		t.Errorf("Expected %d services in comparison, got %d", len(services), len(comparison.Services))
	}
}

func TestGenerateReport(t *testing.T) {
	collector := metrics.NewCollector()
	
	// Test with empty simulation IDs
	report := collector.GenerateReport([]int64{})
	
	if report == nil {
		t.Error("GenerateReport should return a valid report")
	}
	
	if len(report.Simulations) != 0 {
		t.Error("Report should have no simulations for empty input")
	}
	
	// Test with some simulation IDs
	simulationIDs := []int64{1, 2, 3}
	report = collector.GenerateReport(simulationIDs)
	
	if report == nil {
		t.Error("GenerateReport should return a valid report")
	}
	
	if report.GeneratedAt.IsZero() {
		t.Error("Report should have a valid generation timestamp")
	}
}
