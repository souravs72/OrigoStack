# Advanced Features - Detailed Specifications

> **Instructions**: Delete each feature specification after implementation is complete

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
