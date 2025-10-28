# Advanced Features - Detailed Specifications

> **Instructions**: Delete each feature specification after implementation is complete

---

## 🟡 **FEATURE 4: Response Validation Framework**

### Overview

Implement comprehensive response validation to ensure API correctness, not just performance.

### Current State

```go
// Current: Only status code check
if resp.StatusCode >= 200 && resp.StatusCode < 300 {
    atomic.AddInt64(&sim.successCount, 1)
} else {
    atomic.AddInt64(&sim.errorCount, 1)
}
```

### Required Implementation

#### 4.1 Validation Configuration Structure

```go
type ResponseValidation struct {
    StatusCodes   []int                 `json:"status_codes"`           // Expected status codes
    Headers       map[string]string     `json:"headers"`                // Expected headers
    Body          *BodyValidation       `json:"body,omitempty"`         // Body validation rules
    ResponseTime  *TimeValidation       `json:"response_time,omitempty"` // SLA validation
    ContentType   string                `json:"content_type,omitempty"` // Expected content type
    Assertions    []Assertion           `json:"assertions,omitempty"`   // Custom assertions
}

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

type BodyValidationType string
const (
    ValidationTypeJSON   BodyValidationType = "json"
    ValidationTypeXML    BodyValidationType = "xml"
    ValidationTypeText   BodyValidationType = "text"
    ValidationTypeRegex  BodyValidationType = "regex"
)

type JSONPathAssertion struct {
    Path     string      `json:"path"`
    Expected interface{} `json:"expected"`
    Operator string      `json:"operator"` // equals, not_equals, contains, gt, lt, exists
}

type XPathAssertion struct {
    XPath    string `json:"xpath"`
    Expected string `json:"expected"`
    Operator string `json:"operator"`
}

type RegexAssertion struct {
    Pattern string `json:"pattern"`
    Should  bool   `json:"should"` // true = should match, false = should not match
}

type SizeValidation struct {
    Min *int `json:"min,omitempty"`
    Max *int `json:"max,omitempty"`
}

type TimeValidation struct {
    MaxResponseTime time.Duration `json:"max_response_time"`
    P95Threshold    time.Duration `json:"p95_threshold,omitempty"`
    P99Threshold    time.Duration `json:"p99_threshold,omitempty"`
}

type Assertion struct {
    Name        string `json:"name"`
    Script      string `json:"script"`      // JavaScript expression
    Description string `json:"description"`
}
```

#### 4.2 Validation Engine Implementation

```go
type ValidationEngine struct {
    jsonSchemaCache map[string]*jsonschema.Schema
    mutex          sync.RWMutex
}

func NewValidationEngine() *ValidationEngine {
    return &ValidationEngine{
        jsonSchemaCache: make(map[string]*jsonschema.Schema),
    }
}

type ValidationResult struct {
    Passed      bool                    `json:"passed"`
    Errors      []ValidationError       `json:"errors,omitempty"`
    Warnings    []ValidationWarning     `json:"warnings,omitempty"`
    Duration    time.Duration          `json:"duration"`
    Assertions  []AssertionResult      `json:"assertions,omitempty"`
}

type ValidationError struct {
    Type        string `json:"type"`
    Field       string `json:"field,omitempty"`
    Expected    string `json:"expected"`
    Actual      string `json:"actual"`
    Message     string `json:"message"`
}

type ValidationWarning struct {
    Type    string `json:"type"`
    Message string `json:"message"`
}

type AssertionResult struct {
    Name    string `json:"name"`
    Passed  bool   `json:"passed"`
    Error   string `json:"error,omitempty"`
    Value   interface{} `json:"value,omitempty"`
}

func (ve *ValidationEngine) ValidateResponse(resp *http.Response, body []byte, validation *ResponseValidation, responseTime time.Duration) *ValidationResult {
    result := &ValidationResult{
        Passed:     true,
        Errors:     make([]ValidationError, 0),
        Warnings:   make([]ValidationWarning, 0),
        Assertions: make([]AssertionResult, 0),
        Duration:   responseTime,
    }

    // Validate status code
    if len(validation.StatusCodes) > 0 {
        validStatus := false
        for _, code := range validation.StatusCodes {
            if resp.StatusCode == code {
                validStatus = true
                break
            }
        }
        if !validStatus {
            result.Passed = false
            result.Errors = append(result.Errors, ValidationError{
                Type:     "status_code",
                Expected: fmt.Sprintf("one of %v", validation.StatusCodes),
                Actual:   fmt.Sprintf("%d", resp.StatusCode),
                Message:  "Unexpected status code",
            })
        }
    }

    // Validate headers
    for expectedHeader, expectedValue := range validation.Headers {
        actualValue := resp.Header.Get(expectedHeader)
        if actualValue != expectedValue {
            result.Passed = false
            result.Errors = append(result.Errors, ValidationError{
                Type:     "header",
                Field:    expectedHeader,
                Expected: expectedValue,
                Actual:   actualValue,
                Message:  fmt.Sprintf("Header %s mismatch", expectedHeader),
            })
        }
    }

    // Validate content type
    if validation.ContentType != "" {
        actualContentType := resp.Header.Get("Content-Type")
        if !strings.Contains(actualContentType, validation.ContentType) {
            result.Passed = false
            result.Errors = append(result.Errors, ValidationError{
                Type:     "content_type",
                Expected: validation.ContentType,
                Actual:   actualContentType,
                Message:  "Content-Type mismatch",
            })
        }
    }

    // Validate response time
    if validation.ResponseTime != nil {
        if responseTime > validation.ResponseTime.MaxResponseTime {
            result.Passed = false
            result.Errors = append(result.Errors, ValidationError{
                Type:     "response_time",
                Expected: validation.ResponseTime.MaxResponseTime.String(),
                Actual:   responseTime.String(),
                Message:  "Response time exceeded threshold",
            })
        }
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
        assertionResults := ve.executeAssertions(resp, body, validation.Assertions)
        result.Assertions = assertionResults
        for _, ar := range assertionResults {
            if !ar.Passed {
                result.Passed = false
            }
        }
    }

    return result
}
```

#### 4.3 JSON Schema Validation

```go
func (ve *ValidationEngine) validateJSONSchema(body []byte, schemaStr string) *ValidationResult {
    result := &ValidationResult{Passed: true}

    // Check cache first
    ve.mutex.RLock()
    schema, cached := ve.jsonSchemaCache[schemaStr]
    ve.mutex.RUnlock()

    if !cached {
        // Compile and cache schema
        compiler := jsonschema.NewCompiler()
        if err := compiler.AddResource("schema.json", strings.NewReader(schemaStr)); err != nil {
            result.Passed = false
            result.Errors = append(result.Errors, ValidationError{
                Type:    "json_schema",
                Message: fmt.Sprintf("Invalid JSON schema: %v", err),
            })
            return result
        }

        var err error
        schema, err = compiler.Compile("schema.json")
        if err != nil {
            result.Passed = false
            result.Errors = append(result.Errors, ValidationError{
                Type:    "json_schema",
                Message: fmt.Sprintf("Schema compilation failed: %v", err),
            })
            return result
        }

        // Cache the compiled schema
        ve.mutex.Lock()
        ve.jsonSchemaCache[schemaStr] = schema
        ve.mutex.Unlock()
    }

    // Parse JSON body
    var jsonData interface{}
    if err := json.Unmarshal(body, &jsonData); err != nil {
        result.Passed = false
        result.Errors = append(result.Errors, ValidationError{
            Type:    "json_parse",
            Message: fmt.Sprintf("Invalid JSON: %v", err),
        })
        return result
    }

    // Validate against schema
    if err := schema.Validate(jsonData); err != nil {
        result.Passed = false
        if validationErr, ok := err.(*jsonschema.ValidationError); ok {
            for _, subErr := range validationErr.DetailedOutput().Errors {
                result.Errors = append(result.Errors, ValidationError{
                    Type:    "json_schema",
                    Field:   subErr.InstanceLocation,
                    Message: subErr.Error,
                })
            }
        } else {
            result.Errors = append(result.Errors, ValidationError{
                Type:    "json_schema",
                Message: err.Error(),
            })
        }
    }

    return result
}
```

#### 4.4 JSONPath Validation

```go
func (ve *ValidationEngine) validateJSONPath(body []byte, assertions []JSONPathAssertion) *ValidationResult {
    result := &ValidationResult{Passed: true}

    var jsonData interface{}
    if err := json.Unmarshal(body, &jsonData); err != nil {
        result.Passed = false
        result.Errors = append(result.Errors, ValidationError{
            Type:    "json_parse",
            Message: fmt.Sprintf("Invalid JSON: %v", err),
        })
        return result
    }

    for _, assertion := range assertions {
        values, err := jsonpath.Get(assertion.Path, jsonData)
        if err != nil {
            result.Passed = false
            result.Errors = append(result.Errors, ValidationError{
                Type:    "jsonpath",
                Field:   assertion.Path,
                Message: fmt.Sprintf("JSONPath error: %v", err),
            })
            continue
        }

        if !ve.evaluateAssertion(values, assertion.Expected, assertion.Operator) {
            result.Passed = false
            result.Errors = append(result.Errors, ValidationError{
                Type:     "jsonpath",
                Field:    assertion.Path,
                Expected: fmt.Sprintf("%v", assertion.Expected),
                Actual:   fmt.Sprintf("%v", values),
                Message:  fmt.Sprintf("JSONPath assertion failed: %s %s %v", assertion.Path, assertion.Operator, assertion.Expected),
            })
        }
    }

    return result
}

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
```

#### 4.5 Custom Assertion Engine (JavaScript)

```go
import "github.com/robertkrimen/otto"

func (ve *ValidationEngine) executeAssertions(resp *http.Response, body []byte, assertions []Assertion) []AssertionResult {
    results := make([]AssertionResult, len(assertions))

    for i, assertion := range assertions {
        result := AssertionResult{
            Name:   assertion.Name,
            Passed: false,
        }

        // Create JavaScript runtime
        vm := otto.New()

        // Set up context variables
        vm.Set("response", map[string]interface{}{
            "status":      resp.StatusCode,
            "headers":     resp.Header,
            "body":        string(body),
            "contentType": resp.Header.Get("Content-Type"),
        })

        // Helper functions
        vm.Set("jsonPath", func(path string) interface{} {
            var jsonData interface{}
            json.Unmarshal(body, &jsonData)
            values, _ := jsonpath.Get(path, jsonData)
            return values
        })

        vm.Set("parseJSON", func() interface{} {
            var jsonData interface{}
            json.Unmarshal(body, &jsonData)
            return jsonData
        })

        // Execute assertion script
        value, err := vm.Run(assertion.Script)
        if err != nil {
            result.Error = err.Error()
        } else {
            if boolValue, err := value.ToBoolean(); err == nil {
                result.Passed = boolValue
            } else {
                result.Error = "Assertion must return boolean value"
            }

            if exportedValue, err := value.Export(); err == nil {
                result.Value = exportedValue
            }
        }

        results[i] = result
    }

    return results
}
```

### Integration with Simulation Engine

#### 4.6 Enhanced Request Execution with Validation

```go
func (e *Engine) executeRequest(sim *Simulation, workerPool <-chan struct{}, wg *sync.WaitGroup) {
    defer func() {
        <-workerPool
        wg.Done()
    }()

    startTime := time.Now()

    // ... existing request setup code ...

    // Execute request
    resp, err := sim.client.Do(req)
    responseTime := time.Since(startTime)

    atomic.AddInt64(&sim.requestCount, 1)

    if err != nil {
        atomic.AddInt64(&sim.errorCount, 1)
        e.recordValidationResult(sim, nil, responseTime, &ValidationResult{
            Passed: false,
            Errors: []ValidationError{{
                Type:    "network",
                Message: err.Error(),
            }},
        })
        return
    }
    defer resp.Body.Close()

    // Read response body
    body, err := io.ReadAll(resp.Body)
    if err != nil {
        atomic.AddInt64(&sim.errorCount, 1)
        return
    }

    // Perform validation if configured
    var validationResult *ValidationResult
    if sim.config.Validation != nil {
        validationResult = e.validationEngine.ValidateResponse(resp, body, sim.config.Validation, responseTime)
    } else {
        // Default validation (status code only)
        validationResult = &ValidationResult{
            Passed: resp.StatusCode >= 200 && resp.StatusCode < 300,
        }
    }

    // Record results
    if validationResult.Passed {
        atomic.AddInt64(&sim.successCount, 1)
    } else {
        atomic.AddInt64(&sim.errorCount, 1)
    }

    // Record response time and validation results
    sim.mu.Lock()
    sim.responseTimes = append(sim.responseTimes, responseTime)
    sim.mu.Unlock()

    e.recordValidationResult(sim, resp, responseTime, validationResult)
}

func (e *Engine) recordValidationResult(sim *Simulation, resp *http.Response, responseTime time.Duration, validation *ValidationResult) {
    // Store validation results for reporting
    validationRecord := ValidationRecord{
        SimulationID:     sim.config.ID,
        Timestamp:        time.Now(),
        ResponseTime:     responseTime,
        StatusCode:       0,
        ValidationResult: validation,
    }

    if resp != nil {
        validationRecord.StatusCode = resp.StatusCode
    }

    // Store in database or memory for reporting
    e.validationResults.Store(validationRecord)

    // Broadcast validation failures via WebSocket for real-time monitoring
    if !validation.Passed {
        e.wsHub.Broadcast("validation_failure", validationRecord)
    }
}
```

### Implementation Files to Create/Modify

#### Backend Files

```
internal/simulator/validation_engine.go       (new)
internal/simulator/validation_types.go        (new)
internal/simulator/assertion_engine.go        (new)
internal/simulator/engine.go                  (modify executeRequest)
internal/database/validation_models.go        (new)
```

#### Frontend Files

```
src/components/config/ValidationConfig.tsx    (new)
src/components/validation/AssertionBuilder.tsx (new)
src/types/ValidationTypes.ts                  (new)
src/pages/ValidationResults.tsx               (new)
```

### API Endpoints to Add

```go
POST /api/v1/validation/test                  // Test validation rules
GET  /api/v1/validation/results/:simulationId // Get validation results
POST /api/v1/validation/schema/validate       // Validate JSON schema
```

### Acceptance Criteria

- [ ] HTTP status code validation working
- [ ] Response header validation implemented
- [ ] JSON schema validation with caching
- [ ] JSONPath assertions for JSON responses
- [ ] XPath assertions for XML responses
- [ ] Regular expression validation
- [ ] Response time SLA validation
- [ ] Custom JavaScript assertions
- [ ] Validation results storage and reporting
- [ ] Real-time validation failure notifications

---

## 🟡 **FEATURE 5: Test Scenarios & Request Chaining**

### Overview

Enable complex multi-step test scenarios that mirror real user workflows.

### Current State

```go
// Current: Single isolated requests only
func (e *Engine) executeRequest(sim *Simulation, workerPool <-chan struct{}, wg *sync.WaitGroup)
```

### Required Implementation

#### 5.1 Scenario Configuration Structure

```go
type TestScenario struct {
    ID          string                 `json:"id"`
    Name        string                 `json:"name"`
    Description string                 `json:"description"`
    Steps       []ScenarioStep         `json:"steps"`
    Variables   map[string]interface{} `json:"variables"`
    Setup       *ScenarioStep          `json:"setup,omitempty"`
    Teardown    *ScenarioStep          `json:"teardown,omitempty"`
    Options     ScenarioOptions        `json:"options"`
}

type ScenarioStep struct {
    ID              string                  `json:"id"`
    Name            string                  `json:"name"`
    Type            StepType               `json:"type"`
    Request         *RequestConfig         `json:"request,omitempty"`
    Validation      *ResponseValidation    `json:"validation,omitempty"`
    DataExtraction  []DataExtractor        `json:"data_extraction,omitempty"`
    Conditions      []StepCondition        `json:"conditions,omitempty"`
    Delay           time.Duration          `json:"delay,omitempty"`
    Retries         int                    `json:"retries,omitempty"`
    OnFailure       FailureAction          `json:"on_failure"`
}

type StepType string
const (
    StepTypeHTTP     StepType = "http"
    StepTypeWait     StepType = "wait"
    StepTypeLoop     StepType = "loop"
    StepTypeIf       StepType = "if"
    StepTypeScript   StepType = "script"
    StepTypeSetVar   StepType = "set_variable"
)

type DataExtractor struct {
    Name     string          `json:"name"`
    Type     ExtractionType  `json:"type"`
    Source   string          `json:"source"`   // JSONPath, XPath, Regex, Header name
    Pattern  string          `json:"pattern,omitempty"`
    Default  interface{}     `json:"default,omitempty"`
}

type ExtractionType string
const (
    ExtractionJSONPath ExtractionType = "jsonpath"
    ExtractionXPath    ExtractionType = "xpath"
    ExtractionRegex    ExtractionType = "regex"
    ExtractionHeader   ExtractionType = "header"
    ExtractionCookie   ExtractionType = "cookie"
)

type StepCondition struct {
    Variable string      `json:"variable"`
    Operator string      `json:"operator"`  // equals, not_equals, contains, gt, lt, exists
    Value    interface{} `json:"value"`
}

type FailureAction string
const (
    FailureActionStop     FailureAction = "stop"
    FailureActionContinue FailureAction = "continue"
    FailureActionRetry    FailureAction = "retry"
    FailureActionSkip     FailureAction = "skip"
)

type ScenarioOptions struct {
    StopOnFirstFailure bool          `json:"stop_on_first_failure"`
    MaxDuration        time.Duration `json:"max_duration"`
    FailureThreshold   float64       `json:"failure_threshold"`
}
```

#### 5.2 Scenario Execution Engine

```go
type ScenarioEngine struct {
    httpClient      *http.Client
    validationEngine *ValidationEngine
    variableStore   *VariableStore
    cookieJar       http.CookieJar
}

type ScenarioContext struct {
    Variables    map[string]interface{}
    CookieJar    http.CookieJar
    StepResults  []StepResult
    StartTime    time.Time
    UserID       string
}

type StepResult struct {
    StepID       string                `json:"step_id"`
    Name         string                `json:"name"`
    StartTime    time.Time            `json:"start_time"`
    Duration     time.Duration        `json:"duration"`
    Success      bool                 `json:"success"`
    StatusCode   int                  `json:"status_code,omitempty"`
    ResponseSize int64                `json:"response_size,omitempty"`
    Error        string               `json:"error,omitempty"`
    Validation   *ValidationResult    `json:"validation,omitempty"`
    Variables    map[string]interface{} `json:"variables,omitempty"`
}

func NewScenarioEngine() *ScenarioEngine {
    jar, _ := cookiejar.New(nil)
    return &ScenarioEngine{
        httpClient: &http.Client{
            Timeout: 30 * time.Second,
            Jar:     jar,
        },
        validationEngine: NewValidationEngine(),
        variableStore:    NewVariableStore(),
        cookieJar:       jar,
    }
}

func (se *ScenarioEngine) ExecuteScenario(scenario *TestScenario, context *ScenarioContext) (*ScenarioResult, error) {
    result := &ScenarioResult{
        ScenarioID:  scenario.ID,
        UserID:      context.UserID,
        StartTime:   time.Now(),
        Steps:       make([]StepResult, 0, len(scenario.Steps)),
        Variables:   make(map[string]interface{}),
    }

    // Copy initial variables
    for k, v := range scenario.Variables {
        context.Variables[k] = v
    }
    for k, v := range context.Variables {
        result.Variables[k] = v
    }

    // Execute setup step if present
    if scenario.Setup != nil {
        setupResult, err := se.executeStep(scenario.Setup, context)
        if err != nil || !setupResult.Success {
            result.Success = false
            result.Error = fmt.Sprintf("Setup failed: %v", err)
            return result, err
        }
        result.Steps = append(result.Steps, *setupResult)
    }

    // Execute main steps
    for _, step := range scenario.Steps {
        // Check scenario timeout
        if scenario.Options.MaxDuration > 0 && time.Since(result.StartTime) > scenario.Options.MaxDuration {
            result.Success = false
            result.Error = "Scenario timeout exceeded"
            break
        }

        stepResult, err := se.executeStep(&step, context)
        result.Steps = append(result.Steps, *stepResult)

        if err != nil || !stepResult.Success {
            result.FailedSteps++

            if scenario.Options.StopOnFirstFailure || step.OnFailure == FailureActionStop {
                result.Success = false
                result.Error = fmt.Sprintf("Step '%s' failed: %v", step.Name, err)
                break
            }
        } else {
            result.SuccessSteps++
        }

        // Update context variables from step results
        if stepResult.Variables != nil {
            for k, v := range stepResult.Variables {
                context.Variables[k] = v
                result.Variables[k] = v
            }
        }
    }

    // Execute teardown step if present
    if scenario.Teardown != nil {
        teardownResult, _ := se.executeStep(scenario.Teardown, context)
        result.Steps = append(result.Steps, *teardownResult)
    }

    result.Duration = time.Since(result.StartTime)
    result.Success = result.FailedSteps == 0

    return result, nil
}
```

#### 5.3 Step Execution Implementation

```go
func (se *ScenarioEngine) executeStep(step *ScenarioStep, context *ScenarioContext) (*StepResult, error) {
    stepResult := &StepResult{
        StepID:    step.ID,
        Name:      step.Name,
        StartTime: time.Now(),
        Variables: make(map[string]interface{}),
    }

    // Check conditions before execution
    if !se.evaluateConditions(step.Conditions, context.Variables) {
        stepResult.Success = true // Condition not met, skip but don't fail
        stepResult.Duration = time.Since(stepResult.StartTime)
        return stepResult, nil
    }

    // Add delay if specified
    if step.Delay > 0 {
        time.Sleep(step.Delay)
    }

    var err error
    var resp *http.Response
    var body []byte

    switch step.Type {
    case StepTypeHTTP:
        resp, body, err = se.executeHTTPStep(step, context)
        if resp != nil {
            stepResult.StatusCode = resp.StatusCode
            stepResult.ResponseSize = int64(len(body))
        }

    case StepTypeWait:
        time.Sleep(step.Delay)
        stepResult.Success = true

    case StepTypeSetVar:
        err = se.executeSetVariableStep(step, context)
        stepResult.Success = err == nil

    case StepTypeScript:
        err = se.executeScriptStep(step, context)
        stepResult.Success = err == nil

    default:
        err = fmt.Errorf("unsupported step type: %s", step.Type)
    }

    stepResult.Duration = time.Since(stepResult.StartTime)

    if err != nil {
        stepResult.Success = false
        stepResult.Error = err.Error()
        return stepResult, err
    }

    // Perform validation if configured
    if step.Validation != nil && resp != nil {
        validationResult := se.validationEngine.ValidateResponse(resp, body, step.Validation, stepResult.Duration)
        stepResult.Validation = validationResult
        stepResult.Success = validationResult.Passed
    } else {
        stepResult.Success = true
    }

    // Extract data from response
    if len(step.DataExtraction) > 0 && body != nil {
        extractedVars, err := se.extractData(step.DataExtraction, resp, body)
        if err != nil {
            stepResult.Error = fmt.Sprintf("Data extraction failed: %v", err)
        } else {
            for k, v := range extractedVars {
                stepResult.Variables[k] = v
                context.Variables[k] = v
            }
        }
    }

    return stepResult, nil
}

func (se *ScenarioEngine) executeHTTPStep(step *ScenarioStep, context *ScenarioContext) (*http.Response, []byte, error) {
    if step.Request == nil {
        return nil, nil, fmt.Errorf("HTTP step missing request configuration")
    }

    // Resolve variables in URL
    url := se.resolveVariables(step.Request.URL, context.Variables)

    // Build request body
    var body io.Reader
    if step.Request.Body != nil {
        bodyContent := se.resolveVariables(step.Request.Body.Content, context.Variables)
        body = strings.NewReader(bodyContent)
    }

    // Create request
    req, err := http.NewRequest(step.Request.Method, url, body)
    if err != nil {
        return nil, nil, err
    }

    // Set headers with variable resolution
    for key, value := range step.Request.Headers {
        resolvedValue := se.resolveVariables(value, context.Variables)
        req.Header.Set(key, resolvedValue)
    }

    // Execute request
    resp, err := se.httpClient.Do(req)
    if err != nil {
        return nil, nil, err
    }
    defer resp.Body.Close()

    // Read response body
    responseBody, err := io.ReadAll(resp.Body)
    if err != nil {
        return resp, nil, err
    }

    return resp, responseBody, nil
}
```

#### 5.4 Data Extraction Implementation

```go
func (se *ScenarioEngine) extractData(extractors []DataExtractor, resp *http.Response, body []byte) (map[string]interface{}, error) {
    variables := make(map[string]interface{})

    for _, extractor := range extractors {
        var value interface{}
        var err error

        switch extractor.Type {
        case ExtractionJSONPath:
            var jsonData interface{}
            if err := json.Unmarshal(body, &jsonData); err != nil {
                return nil, fmt.Errorf("failed to parse JSON for extraction: %v", err)
            }
            value, err = jsonpath.Get(extractor.Source, jsonData)

        case ExtractionRegex:
            regex, compileErr := regexp.Compile(extractor.Pattern)
            if compileErr != nil {
                return nil, fmt.Errorf("invalid regex pattern: %v", compileErr)
            }
            matches := regex.FindStringSubmatch(string(body))
            if len(matches) > 1 {
                value = matches[1] // First capture group
            } else if len(matches) > 0 {
                value = matches[0] // Full match
            }

        case ExtractionHeader:
            value = resp.Header.Get(extractor.Source)

        case ExtractionCookie:
            for _, cookie := range resp.Cookies() {
                if cookie.Name == extractor.Source {
                    value = cookie.Value
                    break
                }
            }

        case ExtractionXPath:
            // XML parsing and XPath evaluation
            value, err = se.extractXPath(body, extractor.Source)

        default:
            return nil, fmt.Errorf("unsupported extraction type: %s", extractor.Type)
        }

        if err != nil && extractor.Default != nil {
            value = extractor.Default
        } else if err != nil {
            return nil, fmt.Errorf("extraction failed for %s: %v", extractor.Name, err)
        }

        variables[extractor.Name] = value
    }

    return variables, nil
}

func (se *ScenarioEngine) resolveVariables(template string, variables map[string]interface{}) string {
    result := template
    for key, value := range variables {
        placeholder := fmt.Sprintf("{{%s}}", key)
        replacement := fmt.Sprintf("%v", value)
        result = strings.ReplaceAll(result, placeholder, replacement)
    }
    return result
}
```

### Integration with Load Testing

#### 5.5 Scenario-Based Load Generation

```go
type ScenarioSimulation struct {
    config     *ScenarioConfig
    scenario   *TestScenario
    engine     *ScenarioEngine
    results    chan ScenarioResult
    userCount  int64
}

type ScenarioConfig struct {
    SimulationConfig          // Embed base config
    Scenario         *TestScenario `json:"scenario"`
    UserDistribution string        `json:"user_distribution"` // "even", "random", "weighted"
}

func (e *Engine) runScenarioSimulation(sim *ScenarioSimulation) {
    ticker := time.NewTicker(time.Second)
    defer ticker.Stop()

    startTime := time.Now()

    for {
        select {
        case <-sim.ctx.Done():
            return
        case <-ticker.C:
            elapsed := time.Since(startTime)
            targetRPS := e.calculateTargetRPS(sim.config, elapsed)

            // Launch scenario executions
            for i := 0; i < int(targetRPS); i++ {
                go e.executeScenarioUser(sim)
            }
        }
    }
}

func (e *Engine) executeScenarioUser(sim *ScenarioSimulation) {
    userID := fmt.Sprintf("user-%d", atomic.AddInt64(&sim.userCount, 1))

    context := &ScenarioContext{
        Variables: make(map[string]interface{}),
        CookieJar: sim.engine.cookieJar,
        StartTime: time.Now(),
        UserID:    userID,
    }

    result, err := sim.engine.ExecuteScenario(sim.scenario, context)
    if err != nil {
        logrus.Errorf("Scenario execution failed for user %s: %v", userID, err)
    }

    // Send result to results channel for metrics collection
    select {
    case sim.results <- *result:
    default:
        // Channel full, drop result
    }
}
```

### Implementation Files to Create/Modify

#### Backend Files

```
internal/simulator/scenario_engine.go         (new)
internal/simulator/scenario_types.go          (new)
internal/simulator/data_extractor.go          (new)
internal/simulator/variable_store.go          (new)
internal/simulator/step_executor.go           (new)
internal/simulator/engine.go                  (modify)
```

#### Frontend Files

```
src/components/scenario/ScenarioBuilder.tsx   (new)
src/components/scenario/StepEditor.tsx        (new)
src/components/scenario/DataExtractor.tsx     (new)
src/pages/ScenarioConfig.tsx                  (new)
src/types/ScenarioTypes.ts                    (new)
```

### API Endpoints to Add

```go
POST /api/v1/scenarios                        // Create scenario
GET  /api/v1/scenarios                        // List scenarios
GET  /api/v1/scenarios/:id                    // Get scenario
PUT  /api/v1/scenarios/:id                    // Update scenario
DELETE /api/v1/scenarios/:id                  // Delete scenario
POST /api/v1/scenarios/:id/test               // Test scenario
POST /api/v1/scenarios/:id/simulate           // Run scenario simulation
```

### Acceptance Criteria

- [ ] Multi-step scenario execution working
- [ ] Data extraction from responses (JSON, XML, headers, cookies)
- [ ] Variable substitution between steps
- [ ] Session cookie persistence across requests
- [ ] Conditional step execution
- [ ] Loop constructs for repeated actions
- [ ] Retry mechanisms for failed steps
- [ ] Setup and teardown steps
- [ ] Scenario-based load testing
- [ ] Visual scenario builder in frontend

---

> **Delete each completed feature specification from this file to track progress**
