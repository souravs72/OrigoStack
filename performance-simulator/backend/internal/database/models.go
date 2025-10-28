package database

import (
	"fmt"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// Initialize sets up the database connection and creates tables
func Initialize(dsn string) (*gorm.DB, error) {
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	// Auto-migrate schemas
	err = db.AutoMigrate(
		&Simulation{},
		&SimulationResult{},
		&ServiceProfile{},
		&Configuration{},
	)
	if err != nil {
		return nil, err
	}

	return db, nil
}

// Simulation represents a performance test run
type Simulation struct {
	ID          int64     `gorm:"primaryKey" json:"id"`
	Name        string    `gorm:"size:255;not null" json:"name"`
	TargetURL   string    `gorm:"size:500;not null" json:"target_url"`
	Method      string    `gorm:"size:10;not null" json:"method"`
	MaxRPS      int       `gorm:"not null" json:"max_rps"`
	Duration    int64     `gorm:"not null" json:"duration"` // Duration in seconds
	Users       int       `gorm:"not null" json:"users"`
	Pattern     string    `gorm:"size:50" json:"pattern"`
	Status      string    `gorm:"size:20;default:'created'" json:"status"`
	StartTime   time.Time `json:"start_time"`
	EndTime     *time.Time `json:"end_time,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	
	// Relations
	Results []SimulationResult `gorm:"foreignKey:SimulationID" json:"results,omitempty"`
}

// SimulationResult stores performance metrics for a simulation
type SimulationResult struct {
	ID              int64     `gorm:"primaryKey" json:"id"`
	SimulationID    int64     `gorm:"index;not null" json:"simulation_id"`
	TotalRequests   int64     `gorm:"not null" json:"total_requests"`
	SuccessfulReqs  int64     `gorm:"not null" json:"successful_requests"`
	FailedRequests  int64     `gorm:"not null" json:"failed_requests"`
	AverageRPS      float64   `gorm:"not null" json:"average_rps"`
	MinResponseTime int64     `json:"min_response_time"` // in microseconds
	MaxResponseTime int64     `json:"max_response_time"`
	AvgResponseTime int64     `json:"avg_response_time"`
	P95ResponseTime int64     `json:"p95_response_time"`
	P99ResponseTime int64     `json:"p99_response_time"`
	ErrorRate       float64   `json:"error_rate"`
	CreatedAt       time.Time `json:"created_at"`

	// Relation
	Simulation Simulation `gorm:"foreignKey:SimulationID" json:"simulation,omitempty"`
}

// ServiceProfile defines a service configuration for testing
type ServiceProfile struct {
	ID          int64     `gorm:"primaryKey" json:"id"`
	Name        string    `gorm:"size:255;not null;uniqueIndex" json:"name"`
	Technology  string    `gorm:"size:100" json:"technology"`
	BaseURL     string    `gorm:"size:500;not null" json:"base_url"`
	Endpoints   string    `gorm:"type:text" json:"endpoints"` // JSON array of endpoints
	Headers     string    `gorm:"type:text" json:"headers"`   // JSON object of default headers
	Description string    `gorm:"type:text" json:"description"`
	IsActive    bool      `gorm:"default:true" json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// Configuration stores reusable simulation configurations
type Configuration struct {
	ID          int64     `gorm:"primaryKey" json:"id"`
	Name        string    `gorm:"size:255;not null" json:"name"`
	Description string    `gorm:"type:text" json:"description"`
	Config      string    `gorm:"type:text;not null" json:"config"` // JSON configuration
	Tags        string    `gorm:"size:500" json:"tags"`             // Comma-separated tags
	IsDefault   bool      `gorm:"default:false" json:"is_default"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
