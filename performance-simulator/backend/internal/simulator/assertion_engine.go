package simulator

import (
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"github.com/sirupsen/logrus"
)

// AssertionEngine handles custom simplified assertions
type AssertionEngine struct {
}

// NewAssertionEngine creates a new assertion engine
func NewAssertionEngine() *AssertionEngine {
	return &AssertionEngine{}
}

// ExecuteAssertions runs all custom simplified assertions
func (ae *AssertionEngine) ExecuteAssertions(resp *http.Response, body []byte, assertions []Assertion) []AssertionResult {
	results := make([]AssertionResult, len(assertions))

	for i, assertion := range assertions {
		result := AssertionResult{
			Name:   assertion.Name,
			Passed: false,
		}

		// Parse and execute simplified assertion expressions
		passed, value, err := ae.executeSimplifiedAssertion(assertion.Script, resp, body)
		if err != nil {
			result.Error = fmt.Sprintf("Assertion execution error: %v", err)
			logrus.Errorf("Assertion '%s' failed: %v", assertion.Name, err)
		} else {
			result.Passed = passed
			result.Value = value
		}

		results[i] = result
	}

	return results
}

// executeSimplifiedAssertion executes a simplified assertion expression
func (ae *AssertionEngine) executeSimplifiedAssertion(script string, resp *http.Response, body []byte) (bool, interface{}, error) {
	// Parse simplified assertion expressions like:
	// - "status == 200"
	// - "contains(body, 'success')"
	// - "header('Content-Type') == 'application/json'"
	// - "jsonpath('$.status') == 'ok'"
	
	script = strings.TrimSpace(script)
	logrus.Debugf("Executing simplified assertion: %s", script)

	// Handle status code checks
	if strings.HasPrefix(script, "status") {
		return ae.evaluateStatusAssertion(script, resp)
	}

	// Handle body content checks
	if strings.HasPrefix(script, "contains(body,") || strings.Contains(script, "body.contains") {
		return ae.evaluateBodyContainsAssertion(script, body)
	}

	// Handle header checks
	if strings.HasPrefix(script, "header(") {
		return ae.evaluateHeaderAssertion(script, resp)
	}

	// Handle JSONPath checks
	if strings.HasPrefix(script, "jsonpath(") {
		return ae.evaluateJSONPathAssertion(script, body)
	}

	// Handle regex checks
	if strings.HasPrefix(script, "regex(") {
		return ae.evaluateRegexAssertion(script, body)
	}

	// Handle size checks
	if strings.HasPrefix(script, "size") {
		return ae.evaluateSizeAssertion(script, body)
	}

	// For unknown expressions, try simple boolean evaluation
	if script == "true" {
		return true, true, nil
	}
	if script == "false" {
		return false, false, nil
	}

	return false, nil, fmt.Errorf("unsupported assertion expression: %s", script)
}

// evaluateStatusAssertion evaluates status code assertions
func (ae *AssertionEngine) evaluateStatusAssertion(script string, resp *http.Response) (bool, interface{}, error) {
	// Examples: "status == 200", "status >= 200 && status < 300", "status != 404"
	statusCode := resp.StatusCode
	
	if strings.Contains(script, "==") {
		parts := strings.Split(script, "==")
		if len(parts) == 2 {
			expectedStr := strings.TrimSpace(parts[1])
			if expected, err := strconv.Atoi(expectedStr); err == nil {
				return statusCode == expected, statusCode, nil
			}
		}
	}
	
	if strings.Contains(script, "!=") {
		parts := strings.Split(script, "!=")
		if len(parts) == 2 {
			expectedStr := strings.TrimSpace(parts[1])
			if expected, err := strconv.Atoi(expectedStr); err == nil {
				return statusCode != expected, statusCode, nil
			}
		}
	}
	
	if strings.Contains(script, ">=") {
		parts := strings.Split(script, ">=")
		if len(parts) == 2 {
			expectedStr := strings.TrimSpace(parts[1])
			if expected, err := strconv.Atoi(expectedStr); err == nil {
				return statusCode >= expected, statusCode, nil
			}
		}
	}
	
	if strings.Contains(script, "<=") {
		parts := strings.Split(script, "<=")
		if len(parts) == 2 {
			expectedStr := strings.TrimSpace(parts[1])
			if expected, err := strconv.Atoi(expectedStr); err == nil {
				return statusCode <= expected, statusCode, nil
			}
		}
	}
	
	return false, statusCode, fmt.Errorf("unsupported status assertion: %s", script)
}

// evaluateBodyContainsAssertion evaluates body content assertions
func (ae *AssertionEngine) evaluateBodyContainsAssertion(script string, body []byte) (bool, interface{}, error) {
	bodyStr := string(body)
	
	// Extract the search string from contains(body, 'text')
	if strings.HasPrefix(script, "contains(body,") {
		start := strings.Index(script, "'")
		if start == -1 {
			start = strings.Index(script, "\"")
		}
		if start != -1 {
			end := strings.LastIndex(script, "'")
			if end == -1 {
				end = strings.LastIndex(script, "\"")
			}
			if end > start {
				searchText := script[start+1 : end]
				contains := strings.Contains(bodyStr, searchText)
				return contains, contains, nil
			}
		}
	}
	
	return false, nil, fmt.Errorf("unsupported body assertion: %s", script)
}

// evaluateHeaderAssertion evaluates header assertions
func (ae *AssertionEngine) evaluateHeaderAssertion(script string, resp *http.Response) (bool, interface{}, error) {
	// Example: "header('Content-Type') == 'application/json'"
	
	// Extract header name
	start := strings.Index(script, "'")
	if start == -1 {
		start = strings.Index(script, "\"")
	}
	if start == -1 {
		return false, nil, fmt.Errorf("invalid header assertion syntax: %s", script)
	}
	
	end := strings.Index(script[start+1:], "'")
	if end == -1 {
		end = strings.Index(script[start+1:], "\"")
	}
	if end == -1 {
		return false, nil, fmt.Errorf("invalid header assertion syntax: %s", script)
	}
	
	headerName := script[start+1 : start+1+end]
	headerValue := resp.Header.Get(headerName)
	
	// Check for equality
	if strings.Contains(script, "==") {
		parts := strings.Split(script, "==")
		if len(parts) == 2 {
			expectedValue := strings.TrimSpace(parts[1])
			// Remove quotes
			expectedValue = strings.Trim(expectedValue, "'\"")
			return headerValue == expectedValue, headerValue, nil
		}
	}
	
	return false, headerValue, fmt.Errorf("unsupported header assertion: %s", script)
}

// evaluateJSONPathAssertion evaluates JSONPath assertions
func (ae *AssertionEngine) evaluateJSONPathAssertion(script string, body []byte) (bool, interface{}, error) {
	// Example: "jsonpath('$.status') == 'ok'"
	
	var jsonData interface{}
	if err := json.Unmarshal(body, &jsonData); err != nil {
		return false, nil, fmt.Errorf("invalid JSON body: %v", err)
	}
	
	// Extract JSONPath
	start := strings.Index(script, "'")
	if start == -1 {
		start = strings.Index(script, "\"")
	}
	if start == -1 {
		return false, nil, fmt.Errorf("invalid jsonpath assertion syntax: %s", script)
	}
	
	end := strings.Index(script[start+1:], "'")
	if end == -1 {
		end = strings.Index(script[start+1:], "\"")
	}
	if end == -1 {
		return false, nil, fmt.Errorf("invalid jsonpath assertion syntax: %s", script)
	}
	
	jsonPath := script[start+1 : start+1+end]
	value := ae.extractJSONPathValue(jsonData, jsonPath)
	
	// Check for equality
	if strings.Contains(script, "==") {
		parts := strings.Split(script, "==")
		if len(parts) == 2 {
			expectedValue := strings.TrimSpace(parts[1])
			expectedValue = strings.Trim(expectedValue, "'\"")
			
			// Convert value to string for comparison
			valueStr := fmt.Sprintf("%v", value)
			return valueStr == expectedValue, value, nil
		}
	}
	
	return false, value, fmt.Errorf("unsupported jsonpath assertion: %s", script)
}

// evaluateRegexAssertion evaluates regex assertions
func (ae *AssertionEngine) evaluateRegexAssertion(script string, body []byte) (bool, interface{}, error) {
	// Example: "regex('\\d+') matches body"
	
	bodyStr := string(body)
	
	// Extract regex pattern
	start := strings.Index(script, "'")
	if start == -1 {
		start = strings.Index(script, "\"")
	}
	if start == -1 {
		return false, nil, fmt.Errorf("invalid regex assertion syntax: %s", script)
	}
	
	end := strings.Index(script[start+1:], "'")
	if end == -1 {
		end = strings.Index(script[start+1:], "\"")
	}
	if end == -1 {
		return false, nil, fmt.Errorf("invalid regex assertion syntax: %s", script)
	}
	
	pattern := script[start+1 : start+1+end]
	
	matched, err := regexp.MatchString(pattern, bodyStr)
	if err != nil {
		return false, nil, fmt.Errorf("invalid regex pattern '%s': %v", pattern, err)
	}
	
	return matched, matched, nil
}

// evaluateSizeAssertion evaluates size assertions
func (ae *AssertionEngine) evaluateSizeAssertion(script string, body []byte) (bool, interface{}, error) {
	// Example: "size > 100", "size <= 1000"
	
	size := len(body)
	
	if strings.Contains(script, "<=") {
		parts := strings.Split(script, "<=")
		if len(parts) == 2 {
			maxSizeStr := strings.TrimSpace(parts[1])
			if maxSize, err := strconv.Atoi(maxSizeStr); err == nil {
				return size <= maxSize, size, nil
			}
		}
	}
	
	if strings.Contains(script, ">=") {
		parts := strings.Split(script, ">=")
		if len(parts) == 2 {
			minSizeStr := strings.TrimSpace(parts[1])
			if minSize, err := strconv.Atoi(minSizeStr); err == nil {
				return size >= minSize, size, nil
			}
		}
	}
	
	if strings.Contains(script, ">") {
		parts := strings.Split(script, ">")
		if len(parts) == 2 {
			minSizeStr := strings.TrimSpace(parts[1])
			if minSize, err := strconv.Atoi(minSizeStr); err == nil {
				return size > minSize, size, nil
			}
		}
	}
	
	if strings.Contains(script, "<") {
		parts := strings.Split(script, "<")
		if len(parts) == 2 {
			maxSizeStr := strings.TrimSpace(parts[1])
			if maxSize, err := strconv.Atoi(maxSizeStr); err == nil {
				return size < maxSize, size, nil
			}
		}
	}
	
	return false, size, fmt.Errorf("unsupported size assertion: %s", script)
}

// extractJSONPathValue extracts value using simplified JSONPath (same as in validation_engine.go)
func (ae *AssertionEngine) extractJSONPathValue(data interface{}, path string) interface{} {
	if path == "$" {
		return data
	}
	
	if strings.HasPrefix(path, "$.") {
		fieldPath := strings.TrimPrefix(path, "$.")
		return ae.getNestedValue(data, fieldPath)
	}
	
	return nil
}

// getNestedValue extracts nested values from JSON data (same as in validation_engine.go)
func (ae *AssertionEngine) getNestedValue(data interface{}, path string) interface{} {
	parts := strings.Split(path, ".")
	current := data
	
	for _, part := range parts {
		// Handle array indices
		if strings.Contains(part, "[") && strings.Contains(part, "]") {
			// Simple array index handling like "items[0]"
			beforeBracket := strings.Split(part, "[")[0]
			indexStr := strings.Split(strings.Split(part, "[")[1], "]")[0]
			
			if m, ok := current.(map[string]interface{}); ok {
				current = m[beforeBracket]
			} else {
				return nil
			}
			
			if arr, ok := current.([]interface{}); ok {
				if index, err := strconv.Atoi(indexStr); err == nil && index < len(arr) {
					current = arr[index]
				} else {
					return nil
				}
			} else {
				return nil
			}
		} else {
			if m, ok := current.(map[string]interface{}); ok {
				current = m[part]
			} else {
				return nil
			}
		}
	}
	
	return current
}

// ValidateAssertion validates a single assertion syntax without executing it
func (ae *AssertionEngine) ValidateAssertion(assertion *Assertion) error {
	if assertion.Script == "" {
		return fmt.Errorf("assertion script cannot be empty")
	}
	
	script := strings.TrimSpace(assertion.Script)
	
	// Basic syntax validation for supported expressions
	supportedPrefixes := []string{
		"status",
		"contains(body,",
		"header(",
		"jsonpath(",
		"regex(",
		"size",
		"true",
		"false",
	}
	
	valid := false
	for _, prefix := range supportedPrefixes {
		if strings.HasPrefix(script, prefix) {
			valid = true
			break
		}
	}
	
	if !valid {
		return fmt.Errorf("unsupported assertion expression: %s. Supported expressions: status==200, contains(body,'text'), header('name')=='value', jsonpath('$.field')=='value', regex('pattern'), size>100", script)
	}
	
	return nil
}