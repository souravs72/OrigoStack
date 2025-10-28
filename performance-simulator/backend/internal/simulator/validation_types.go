package simulator

import "time"

// ResponseValidation defines the validation rules for HTTP responses
type ResponseValidation struct {
	StatusCodes   []int                 `json:"status_codes"`           // Expected status codes
	Headers       map[string]string     `json:"headers"`                // Expected headers
	Body          *BodyValidation       `json:"body,omitempty"`         // Body validation rules
	ResponseTime  *TimeValidation       `json:"response_time,omitempty"` // SLA validation
	ContentType   string                `json:"content_type,omitempty"` // Expected content type
	Assertions    []Assertion           `json:"assertions,omitempty"`   // Custom assertions
}

// BodyValidation defines validation rules for response body
type BodyValidation struct {
	Type        BodyValidationType `json:"type"`
	JSONSchema  string            `json:"json_schema,omitempty"`
	XPath       []XPathAssertion  `json:"xpath,omitempty"`
	JSONPath    []JSONPathAssertion `json:"jsonpath,omitempty"`
	Regex       []RegexAssertion  `json:"regex,omitempty"`
	Contains    []string          `json:"contains,omitempty"`
	NotContains []string          `json:"not_contains,omitempty"`
	Size        *SizeValidation   `json:"size,omitempty"`
}

// BodyValidationType defines the type of body validation
type BodyValidationType string

const (
	ValidationTypeJSON   BodyValidationType = "json"
	ValidationTypeXML    BodyValidationType = "xml"
	ValidationTypeText   BodyValidationType = "text"
	ValidationTypeRegex  BodyValidationType = "regex"
)

// JSONPathAssertion defines JSONPath-based assertions
type JSONPathAssertion struct {
	Path     string      `json:"path"`
	Expected interface{} `json:"expected"`
	Operator string      `json:"operator"` // equals, not_equals, contains, gt, lt, gte, lte, exists
}

// XPathAssertion defines XPath-based assertions for XML responses
type XPathAssertion struct {
	XPath    string `json:"xpath"`
	Expected string `json:"expected"`
	Operator string `json:"operator"`
}

// RegexAssertion defines regular expression assertions
type RegexAssertion struct {
	Pattern string `json:"pattern"`
	Should  bool   `json:"should"` // true = should match, false = should not match
}

// SizeValidation defines size constraints for response body
type SizeValidation struct {
	Min *int `json:"min,omitempty"`
	Max *int `json:"max,omitempty"`
}

// TimeValidation defines response time validation thresholds
type TimeValidation struct {
	MaxResponseTime time.Duration `json:"max_response_time"`
	P95Threshold    time.Duration `json:"p95_threshold,omitempty"`
	P99Threshold    time.Duration `json:"p99_threshold,omitempty"`
}

// Assertion defines custom JavaScript assertions
type Assertion struct {
	Name        string `json:"name"`
	Script      string `json:"script"`      // JavaScript expression
	Description string `json:"description"`
}

// ValidationResult represents the result of response validation
type ValidationResult struct {
	Passed      bool                    `json:"passed"`
	Errors      []ValidationError       `json:"errors,omitempty"`
	Warnings    []ValidationWarning     `json:"warnings,omitempty"`
	Duration    time.Duration          `json:"duration"`
	Assertions  []AssertionResult      `json:"assertions,omitempty"`
}

// ValidationError represents a validation failure
type ValidationError struct {
	Type        string `json:"type"`
	Field       string `json:"field,omitempty"`
	Expected    string `json:"expected"`
	Actual      string `json:"actual"`
	Message     string `json:"message"`
}

// ValidationWarning represents a validation warning (non-fatal)
type ValidationWarning struct {
	Type    string `json:"type"`
	Message string `json:"message"`
}

// AssertionResult represents the result of a custom assertion
type AssertionResult struct {
	Name    string      `json:"name"`
	Passed  bool        `json:"passed"`
	Error   string      `json:"error,omitempty"`
	Value   interface{} `json:"value,omitempty"`
}

// ValidationRecord stores validation results for reporting
type ValidationRecord struct {
	SimulationID     int64              `json:"simulation_id"`
	Timestamp        time.Time          `json:"timestamp"`
	ResponseTime     time.Duration      `json:"response_time"`
	StatusCode       int                `json:"status_code"`
	ValidationResult *ValidationResult  `json:"validation_result"`
}

// ValidationStats provides aggregated validation statistics
type ValidationStats struct {
	TotalValidations  int64   `json:"total_validations"`
	PassedValidations int64   `json:"passed_validations"`
	FailedValidations int64   `json:"failed_validations"`
	PassRate          float64 `json:"pass_rate"`
	CommonErrors      []ValidationErrorSummary `json:"common_errors"`
}

// ValidationErrorSummary aggregates validation errors by type
type ValidationErrorSummary struct {
	Type        string `json:"type"`
	Count       int64  `json:"count"`
	Percentage  float64 `json:"percentage"`
	LastSeen    time.Time `json:"last_seen"`
}
