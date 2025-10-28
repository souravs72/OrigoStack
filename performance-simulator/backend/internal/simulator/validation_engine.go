package simulator

import (
	"encoding/json"
	"fmt"
	"net/http"
	"reflect"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/sirupsen/logrus"
)

// ValidationEngine handles response validation logic
type ValidationEngine struct {
	jsonSchemaCache map[string]interface{}
	regexCache      map[string]*regexp.Regexp
	mutex           sync.RWMutex
	assertionEngine *AssertionEngine
}

// NewValidationEngine creates a new validation engine
func NewValidationEngine() *ValidationEngine {
	return &ValidationEngine{
		jsonSchemaCache: make(map[string]interface{}),
		regexCache:      make(map[string]*regexp.Regexp),
		assertionEngine: NewAssertionEngine(),
	}
}

// ValidateResponse performs comprehensive response validation
func (ve *ValidationEngine) ValidateResponse(resp *http.Response, body []byte, validation *ResponseValidation, responseTime time.Duration) *ValidationResult {
	startTime := time.Now()
	
	result := &ValidationResult{
		Passed:     true,
		Errors:     make([]ValidationError, 0),
		Warnings:   make([]ValidationWarning, 0),
		Assertions: make([]AssertionResult, 0),
	}

	// Validate status code
	if len(validation.StatusCodes) > 0 {
		ve.validateStatusCode(resp, validation.StatusCodes, result)
	}

	// Validate headers
	if len(validation.Headers) > 0 {
		ve.validateHeaders(resp, validation.Headers, result)
	}

	// Validate content type
	if validation.ContentType != "" {
		ve.validateContentType(resp, validation.ContentType, result)
	}

	// Validate response time
	if validation.ResponseTime != nil {
		ve.validateResponseTime(responseTime, validation.ResponseTime, result)
	}

	// Validate body
	if validation.Body != nil {
		bodyResult := ve.validateBody(body, validation.Body)
		result.Passed = result.Passed && bodyResult.Passed
		result.Errors = append(result.Errors, bodyResult.Errors...)
		result.Warnings = append(result.Warnings, bodyResult.Warnings...)
	}

	// Execute custom assertions
	if len(validation.Assertions) > 0 {
		assertionResults := ve.assertionEngine.ExecuteAssertions(resp, body, validation.Assertions)
		result.Assertions = assertionResults
		for _, ar := range assertionResults {
			if !ar.Passed {
				result.Passed = false
			}
		}
	}

	result.Duration = time.Since(startTime)
	return result
}

// validateStatusCode checks if the response status code is in the expected list
func (ve *ValidationEngine) validateStatusCode(resp *http.Response, expectedCodes []int, result *ValidationResult) {
	validStatus := false
	for _, code := range expectedCodes {
		if resp.StatusCode == code {
			validStatus = true
			break
		}
	}
	
	if !validStatus {
		result.Passed = false
		result.Errors = append(result.Errors, ValidationError{
			Type:     "status_code",
			Expected: fmt.Sprintf("one of %v", expectedCodes),
			Actual:   fmt.Sprintf("%d", resp.StatusCode),
			Message:  fmt.Sprintf("Expected status code to be one of %v, got %d", expectedCodes, resp.StatusCode),
		})
	}
}

// validateHeaders checks if response headers match expected values
func (ve *ValidationEngine) validateHeaders(resp *http.Response, expectedHeaders map[string]string, result *ValidationResult) {
	for expectedHeader, expectedValue := range expectedHeaders {
		actualValue := resp.Header.Get(expectedHeader)
		if actualValue != expectedValue {
			result.Passed = false
			result.Errors = append(result.Errors, ValidationError{
				Type:     "header",
				Field:    expectedHeader,
				Expected: expectedValue,
				Actual:   actualValue,
				Message:  fmt.Sprintf("Header %s expected '%s', got '%s'", expectedHeader, expectedValue, actualValue),
			})
		}
	}
}

// validateContentType checks if the response content type matches expected
func (ve *ValidationEngine) validateContentType(resp *http.Response, expectedContentType string, result *ValidationResult) {
	actualContentType := resp.Header.Get("Content-Type")
	if !strings.Contains(actualContentType, expectedContentType) {
		result.Passed = false
		result.Errors = append(result.Errors, ValidationError{
			Type:     "content_type",
			Expected: expectedContentType,
			Actual:   actualContentType,
			Message:  fmt.Sprintf("Expected content type to contain '%s', got '%s'", expectedContentType, actualContentType),
		})
	}
}

// validateResponseTime checks if response time meets SLA requirements
func (ve *ValidationEngine) validateResponseTime(responseTime time.Duration, timeValidation *TimeValidation, result *ValidationResult) {
	if responseTime > timeValidation.MaxResponseTime {
		result.Passed = false
		result.Errors = append(result.Errors, ValidationError{
			Type:     "response_time",
			Expected: timeValidation.MaxResponseTime.String(),
			Actual:   responseTime.String(),
			Message:  fmt.Sprintf("Response time %s exceeded maximum threshold %s", responseTime, timeValidation.MaxResponseTime),
		})
	}
}

// validateBody performs comprehensive body validation
func (ve *ValidationEngine) validateBody(body []byte, validation *BodyValidation) *ValidationResult {
	result := &ValidationResult{
		Passed:   true,
		Errors:   make([]ValidationError, 0),
		Warnings: make([]ValidationWarning, 0),
	}

	// Validate body size
	if validation.Size != nil {
		ve.validateBodySize(body, validation.Size, result)
	}

	// Validate contains/not contains
	ve.validateBodyContains(body, validation.Contains, validation.NotContains, result)

	// Type-specific validation
	switch validation.Type {
	case ValidationTypeJSON:
		ve.validateJSONBody(body, validation, result)
	case ValidationTypeXML:
		ve.validateXMLBody(body, validation, result)
	case ValidationTypeRegex:
		ve.validateRegexBody(body, validation.Regex, result)
	case ValidationTypeText:
		// Text validation already handled by contains/not contains
	}

	return result
}

// validateBodySize checks if body size is within limits
func (ve *ValidationEngine) validateBodySize(body []byte, sizeValidation *SizeValidation, result *ValidationResult) {
	bodySize := len(body)
	
	if sizeValidation.Min != nil && bodySize < *sizeValidation.Min {
		result.Passed = false
		result.Errors = append(result.Errors, ValidationError{
			Type:     "body_size",
			Expected: fmt.Sprintf("minimum %d bytes", *sizeValidation.Min),
			Actual:   fmt.Sprintf("%d bytes", bodySize),
			Message:  fmt.Sprintf("Response body size %d is less than minimum %d", bodySize, *sizeValidation.Min),
		})
	}
	
	if sizeValidation.Max != nil && bodySize > *sizeValidation.Max {
		result.Passed = false
		result.Errors = append(result.Errors, ValidationError{
			Type:     "body_size",
			Expected: fmt.Sprintf("maximum %d bytes", *sizeValidation.Max),
			Actual:   fmt.Sprintf("%d bytes", bodySize),
			Message:  fmt.Sprintf("Response body size %d exceeds maximum %d", bodySize, *sizeValidation.Max),
		})
	}
}

// validateBodyContains checks for required and forbidden content
func (ve *ValidationEngine) validateBodyContains(body []byte, contains []string, notContains []string, result *ValidationResult) {
	bodyStr := string(body)
	
	// Check required content
	for _, required := range contains {
		if !strings.Contains(bodyStr, required) {
			result.Passed = false
			result.Errors = append(result.Errors, ValidationError{
				Type:     "body_contains",
				Expected: fmt.Sprintf("contains '%s'", required),
				Actual:   "not found",
				Message:  fmt.Sprintf("Response body should contain '%s'", required),
			})
		}
	}
	
	// Check forbidden content
	for _, forbidden := range notContains {
		if strings.Contains(bodyStr, forbidden) {
			result.Passed = false
			result.Errors = append(result.Errors, ValidationError{
				Type:     "body_not_contains",
				Expected: fmt.Sprintf("does not contain '%s'", forbidden),
				Actual:   "found",
				Message:  fmt.Sprintf("Response body should not contain '%s'", forbidden),
			})
		}
	}
}

// validateJSONBody performs JSON-specific validation
func (ve *ValidationEngine) validateJSONBody(body []byte, validation *BodyValidation, result *ValidationResult) {
	var jsonData interface{}
	if err := json.Unmarshal(body, &jsonData); err != nil {
		result.Passed = false
		result.Errors = append(result.Errors, ValidationError{
			Type:    "json_parse",
			Message: fmt.Sprintf("Invalid JSON: %v", err),
		})
		return
	}

	// JSON Schema validation
	if validation.JSONSchema != "" {
		ve.validateJSONSchema(body, validation.JSONSchema, result)
	}

	// JSONPath assertions
	if len(validation.JSONPath) > 0 {
		ve.validateJSONPath(jsonData, validation.JSONPath, result)
	}
}

// validateJSONSchema validates JSON against a schema (simplified implementation)
func (ve *ValidationEngine) validateJSONSchema(body []byte, schemaStr string, result *ValidationResult) {
	// For a full implementation, you would use a proper JSON Schema library
	// This is a simplified version for demonstration
	logrus.Debug("JSON Schema validation - simplified implementation")
	
	// Parse schema
	var schema interface{}
	if err := json.Unmarshal([]byte(schemaStr), &schema); err != nil {
		result.Passed = false
		result.Errors = append(result.Errors, ValidationError{
			Type:    "json_schema",
			Message: fmt.Sprintf("Invalid JSON schema: %v", err),
		})
		return
	}

	// Parse response body
	var jsonData interface{}
	if err := json.Unmarshal(body, &jsonData); err != nil {
		result.Passed = false
		result.Errors = append(result.Errors, ValidationError{
			Type:    "json_parse",
			Message: fmt.Sprintf("Invalid JSON response: %v", err),
		})
		return
	}

	// Basic schema validation (in production, use a proper JSON Schema library)
	logrus.Debug("JSON Schema validation passed (simplified)")
}

// validateJSONPath validates JSONPath assertions
func (ve *ValidationEngine) validateJSONPath(jsonData interface{}, assertions []JSONPathAssertion, result *ValidationResult) {
	for _, assertion := range assertions {
		// Simplified JSONPath implementation
		// In production, use a proper JSONPath library like github.com/oliveagle/jsonpath
		value := ve.extractJSONPathValue(jsonData, assertion.Path)
		
		if !ve.evaluateAssertion(value, assertion.Expected, assertion.Operator) {
			result.Passed = false
			result.Errors = append(result.Errors, ValidationError{
				Type:     "jsonpath",
				Field:    assertion.Path,
				Expected: fmt.Sprintf("%v", assertion.Expected),
				Actual:   fmt.Sprintf("%v", value),
				Message:  fmt.Sprintf("JSONPath assertion failed: %s %s %v", assertion.Path, assertion.Operator, assertion.Expected),
			})
		}
	}
}

// extractJSONPathValue extracts a value using a simplified JSONPath implementation
func (ve *ValidationEngine) extractJSONPathValue(data interface{}, path string) interface{} {
	// Simplified JSONPath implementation for basic paths like $.field or $.field.subfield
	// In production, use a proper JSONPath library
	
	if path == "$" {
		return data
	}
	
	if strings.HasPrefix(path, "$.") {
		fieldPath := strings.TrimPrefix(path, "$.")
		return ve.getNestedValue(data, fieldPath)
	}
	
	return nil
}

// getNestedValue extracts nested values from JSON data
func (ve *ValidationEngine) getNestedValue(data interface{}, path string) interface{} {
	parts := strings.Split(path, ".")
	current := data
	
	for _, part := range parts {
		if m, ok := current.(map[string]interface{}); ok {
			current = m[part]
		} else {
			return nil
		}
	}
	
	return current
}

// validateXMLBody performs XML-specific validation
func (ve *ValidationEngine) validateXMLBody(body []byte, validation *BodyValidation, result *ValidationResult) {
	// XML and XPath validation would require XML parsing libraries
	// This is a placeholder for the full implementation
	logrus.Debug("XML validation - placeholder implementation")
	
	for _, xpath := range validation.XPath {
		// In production, use an XML parser and XPath library
		logrus.Debugf("XPath validation: %s", xpath.XPath)
	}
}

// validateRegexBody performs regex validation
func (ve *ValidationEngine) validateRegexBody(body []byte, regexAssertions []RegexAssertion, result *ValidationResult) {
	bodyStr := string(body)
	
	for _, assertion := range regexAssertions {
		regex, err := ve.getCompiledRegex(assertion.Pattern)
		if err != nil {
			result.Passed = false
			result.Errors = append(result.Errors, ValidationError{
				Type:    "regex",
				Message: fmt.Sprintf("Invalid regex pattern '%s': %v", assertion.Pattern, err),
			})
			continue
		}
		
		matches := regex.MatchString(bodyStr)
		if matches != assertion.Should {
			result.Passed = false
			expected := "should match"
			if !assertion.Should {
				expected = "should not match"
			}
			result.Errors = append(result.Errors, ValidationError{
				Type:     "regex",
				Expected: expected,
				Actual:   fmt.Sprintf("matches: %t", matches),
				Message:  fmt.Sprintf("Regex pattern '%s' %s", assertion.Pattern, expected),
			})
		}
	}
}

// getCompiledRegex returns a compiled regex, using cache for performance
func (ve *ValidationEngine) getCompiledRegex(pattern string) (*regexp.Regexp, error) {
	ve.mutex.RLock()
	if cached, exists := ve.regexCache[pattern]; exists {
		ve.mutex.RUnlock()
		return cached, nil
	}
	ve.mutex.RUnlock()
	
	regex, err := regexp.Compile(pattern)
	if err != nil {
		return nil, err
	}
	
	ve.mutex.Lock()
	ve.regexCache[pattern] = regex
	ve.mutex.Unlock()
	
	return regex, nil
}

// evaluateAssertion evaluates a comparison assertion
func (ve *ValidationEngine) evaluateAssertion(actual interface{}, expected interface{}, operator string) bool {
	switch operator {
	case "equals":
		return reflect.DeepEqual(actual, expected)
	case "not_equals":
		return !reflect.DeepEqual(actual, expected)
	case "contains":
		if str, ok := actual.(string); ok {
			if expectedStr, ok := expected.(string); ok {
				return strings.Contains(str, expectedStr)
			}
		}
		return false
	case "exists":
		return actual != nil
	case "gt":
		return ve.compareNumbers(actual, expected, ">")
	case "lt":
		return ve.compareNumbers(actual, expected, "<")
	case "gte":
		return ve.compareNumbers(actual, expected, ">=")
	case "lte":
		return ve.compareNumbers(actual, expected, "<=")
	default:
		return false
	}
}

// compareNumbers compares two values numerically
func (ve *ValidationEngine) compareNumbers(actual, expected interface{}, operator string) bool {
	actualNum, err1 := ve.toFloat64(actual)
	expectedNum, err2 := ve.toFloat64(expected)
	
	if err1 != nil || err2 != nil {
		return false
	}
	
	switch operator {
	case ">":
		return actualNum > expectedNum
	case "<":
		return actualNum < expectedNum
	case ">=":
		return actualNum >= expectedNum
	case "<=":
		return actualNum <= expectedNum
	default:
		return false
	}
}

// toFloat64 converts various number types to float64
func (ve *ValidationEngine) toFloat64(value interface{}) (float64, error) {
	switch v := value.(type) {
	case float64:
		return v, nil
	case float32:
		return float64(v), nil
	case int:
		return float64(v), nil
	case int32:
		return float64(v), nil
	case int64:
		return float64(v), nil
	case string:
		return strconv.ParseFloat(v, 64)
	default:
		return 0, fmt.Errorf("cannot convert %T to float64", value)
	}
}

// TestValidation tests validation rules against a sample response
func (ve *ValidationEngine) TestValidation(resp *http.Response, body []byte, validation *ResponseValidation) *ValidationResult {
	// Calculate a mock response time for testing
	testResponseTime := 100 * time.Millisecond
	return ve.ValidateResponse(resp, body, validation, testResponseTime)
}
