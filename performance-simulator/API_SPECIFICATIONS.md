# API Specifications & Implementation Tracking

> **Instructions**: Delete each API endpoint specification after implementation is complete

---

## 🔴 **CRITICAL API ENDPOINTS TO IMPLEMENT**

### ❌ Authentication & Security Endpoints

#### POST /api/v1/auth/test

Test authentication configuration before running simulation.

**Request Body:**

```json
{
  "auth_type": "bearer|basic|apikey|jwt|oauth2|client_cert",
  "target_url": "https://api.example.com/test",
  "config": {
    // Auth-specific configuration
    "token": "...",
    "username": "...",
    "password": "...",
    "api_key": {...},
    "jwt": {...}
  }
}
```

**Response:**

```json
{
  "success": true,
  "status_code": 200,
  "response_time": "150ms",
  "auth_valid": true,
  "error": null,
  "recommendations": ["Token expires in 2 hours - consider refresh mechanism"]
}
```

**Implementation Status:** ❌ Not Implemented

---

#### POST /api/v1/auth/refresh

Refresh authentication tokens during simulation.

**Request Body:**

```json
{
  "simulation_id": 12345,
  "auth_type": "jwt|oauth2",
  "refresh_token": "...",
  "token_url": "https://auth.example.com/token"
}
```

**Response:**

```json
{
  "success": true,
  "access_token": "new_token_here",
  "expires_in": 3600,
  "token_type": "Bearer"
}
```

**Implementation Status:** ❌ Not Implemented

---

### ❌ Request Body & Configuration Endpoints

#### POST /api/v1/configs/validate

Validate simulation configuration before execution.

**Request Body:**

```json
{
  "name": "Test Simulation",
  "target_url": "https://api.example.com/users",
  "method": "POST",
  "headers": {"Content-Type": "application/json"},
  "body": {
    "type": "json",
    "content": "{\"name\": \"{{username}}\", \"email\": \"{{email}}\"}"
  },
  "auth": {...},
  "validation": {...},
  "max_rps": 1000,
  "duration": "5m"
}
```

**Response:**

```json
{
  "valid": true,
  "errors": [],
  "warnings": ["Variable {{username}} not defined - will use default value"],
  "estimated_resources": {
    "memory_mb": 256,
    "cpu_cores": 0.5,
    "network_mbps": 10
  }
}
```

**Implementation Status:** ❌ Not Implemented

---

#### POST /api/v1/test-connection

Test connectivity and basic request functionality.

**Request Body:**

```json
{
  "target_url": "https://api.example.com/health",
  "method": "GET",
  "headers": {...},
  "auth": {...},
  "timeout": 10
}
```

**Response:**

```json
{
  "success": true,
  "status_code": 200,
  "response_time": "89ms",
  "response_size": 156,
  "ssl_info": {
    "valid": true,
    "expires": "2024-12-31T23:59:59Z",
    "issuer": "Let's Encrypt"
  },
  "dns_resolution_time": "12ms",
  "connection_time": "45ms",
  "error": null
}
```

**Implementation Status:** ❌ Not Implemented

---

### ❌ Response Validation Endpoints

#### POST /api/v1/validation/test

Test response validation rules against sample data.

**Request Body:**

```json
{
  "validation_rules": {
    "status_codes": [200, 201],
    "headers": { "Content-Type": "application/json" },
    "body": {
      "type": "json",
      "json_schema": "{...}",
      "jsonpath": [
        { "path": "$.data.length", "expected": 10, "operator": "gte" }
      ]
    },
    "response_time": { "max_response_time": "200ms" }
  },
  "sample_response": {
    "status_code": 200,
    "headers": { "Content-Type": "application/json" },
    "body": "{\"data\": [{...}], \"total\": 15}",
    "response_time": "150ms"
  }
}
```

**Response:**

```json
{
  "passed": true,
  "errors": [],
  "warnings": [],
  "duration": "5ms",
  "assertions": [
    {
      "name": "Status Code Check",
      "passed": true,
      "expected": "200-201",
      "actual": "200"
    }
  ]
}
```

**Implementation Status:** ❌ Not Implemented

---

#### GET /api/v1/validation/results/:simulationId

Get detailed validation results for a simulation.

**Response:**

```json
{
  "simulation_id": 12345,
  "total_requests": 5000,
  "passed_validations": 4850,
  "failed_validations": 150,
  "validation_rate": 97.0,
  "failure_breakdown": {
    "status_code": 80,
    "response_time": 45,
    "json_schema": 15,
    "custom_assertions": 10
  },
  "recent_failures": [
    {
      "timestamp": "2024-01-15T10:30:00Z",
      "type": "status_code",
      "expected": "200",
      "actual": "500",
      "url": "https://api.example.com/users/123"
    }
  ]
}
```

**Implementation Status:** ❌ Not Implemented

---

### ❌ Test Scenarios & Chaining Endpoints

#### POST /api/v1/scenarios

Create a new test scenario.

**Request Body:**

```json
{
  "name": "User Registration Flow",
  "description": "Complete user registration and verification process",
  "steps": [
    {
      "id": "step1",
      "name": "Register User",
      "type": "http",
      "request": {
        "method": "POST",
        "url": "{{base_url}}/register",
        "body": { "type": "json", "content": "{...}" }
      },
      "data_extraction": [
        { "name": "user_id", "type": "jsonpath", "source": "$.user.id" }
      ]
    },
    {
      "id": "step2",
      "name": "Verify Email",
      "type": "http",
      "request": {
        "method": "GET",
        "url": "{{base_url}}/verify/{{user_id}}"
      }
    }
  ],
  "variables": {
    "base_url": "https://api.example.com"
  }
}
```

**Response:**

```json
{
  "id": "scenario_123",
  "name": "User Registration Flow",
  "created_at": "2024-01-15T10:00:00Z",
  "steps_count": 2,
  "estimated_duration": "5-10s per execution"
}
```

**Implementation Status:** ❌ Not Implemented

---

#### POST /api/v1/scenarios/:id/test

Test a scenario with sample data.

**Request Body:**

```json
{
  "variables": {
    "base_url": "https://staging-api.example.com",
    "test_email": "test@example.com"
  },
  "dry_run": false
}
```

**Response:**

```json
{
  "success": true,
  "duration": "2.5s",
  "steps": [
    {
      "step_id": "step1",
      "name": "Register User",
      "success": true,
      "duration": "150ms",
      "status_code": 201,
      "variables": { "user_id": "12345" }
    },
    {
      "step_id": "step2",
      "name": "Verify Email",
      "success": true,
      "duration": "89ms",
      "status_code": 200
    }
  ]
}
```

**Implementation Status:** ❌ Not Implemented

---

### ❌ Data Management Endpoints

#### POST /api/v1/data/import

Import test data from CSV or JSON files.

**Request Body (multipart/form-data):**

```
file: [CSV/JSON file]
data_type: "csv|json"
mapping: {
  "csv_column_1": "variable_name_1",
  "csv_column_2": "variable_name_2"
}
```

**Response:**

```json
{
  "success": true,
  "records_imported": 1000,
  "data_pool_id": "pool_123",
  "variables": ["username", "email", "age"],
  "sample_record": {
    "username": "john_doe",
    "email": "john@example.com",
    "age": 25
  }
}
```

**Implementation Status:** ❌ Not Implemented

---

#### GET /api/v1/data/pools

List available data pools.

**Response:**

```json
{
  "data_pools": [
    {
      "id": "pool_123",
      "name": "User Test Data",
      "type": "csv",
      "record_count": 1000,
      "variables": ["username", "email", "age"],
      "created_at": "2024-01-15T09:00:00Z"
    }
  ]
}
```

**Implementation Status:** ❌ Not Implemented

---

### ❌ Advanced Reporting Endpoints

#### POST /api/v1/reports/generate

Generate custom performance reports.

**Request Body:**

```json
{
  "simulation_ids": [123, 124, 125],
  "report_type": "pdf|html|json",
  "sections": [
    "executive_summary",
    "performance_metrics",
    "error_analysis",
    "recommendations"
  ],
  "filters": {
    "date_range": {
      "start": "2024-01-01T00:00:00Z",
      "end": "2024-01-31T23:59:59Z"
    },
    "service_type": "go|java"
  }
}
```

**Response:**

```json
{
  "report_id": "report_456",
  "status": "generating",
  "estimated_completion": "2024-01-15T10:35:00Z",
  "download_url": null
}
```

**Implementation Status:** ❌ Not Implemented

---

#### GET /api/v1/reports/:id/download

Download generated report.

**Response:**

- **Content-Type**: `application/pdf` or `text/html`
- **Body**: Report file content

**Implementation Status:** ❌ Not Implemented

---

#### GET /api/v1/analytics/trends

Get performance trends over time.

**Query Parameters:**

- `service_types`: Comma-separated list (go,java)
- `metric`: rps|response_time|error_rate
- `period`: 1h|1d|1w|1m
- `start_date`: ISO date string
- `end_date`: ISO date string

**Response:**

```json
{
  "metric": "rps",
  "period": "1d",
  "data_points": [
    {
      "timestamp": "2024-01-15T00:00:00Z",
      "go_services": 45000,
      "java_services": 13500,
      "total": 58500
    }
  ],
  "insights": [
    "Go services consistently outperform Java by 3.3x",
    "Peak performance occurs at 14:00 UTC daily"
  ]
}
```

**Implementation Status:** ❌ Not Implemented

---

## 🟡 **ENHANCED EXISTING ENDPOINTS**

### ⚠️ POST /api/v1/simulations (NEEDS ENHANCEMENT)

**Current Status**: Basic implementation  
**Missing Features**:

- Request body support
- Authentication configuration
- Response validation rules
- Scenario-based execution

**Required Enhancements:**

```json
{
  // ... existing fields ...
  "body": {
    "type": "json|form|multipart|raw",
    "content": "...",
    "files": [...],
    "form_data": {...}
  },
  "auth": {
    "type": "bearer|basic|apikey|jwt",
    "config": {...}
  },
  "validation": {
    "status_codes": [200, 201],
    "body": {...},
    "response_time": {...}
  },
  "scenario": {
    "steps": [...],
    "variables": {...}
  }
}
```

---

### ⚠️ GET /api/v1/simulations/:id (NEEDS ENHANCEMENT)

**Current Status**: Basic implementation  
**Missing Features**:

- Validation results
- Step-by-step scenario results
- Real-time variable values

**Required Enhancements:**

```json
{
  // ... existing fields ...
  "validation_summary": {
    "total_validations": 5000,
    "passed": 4850,
    "failed": 150,
    "failure_rate": 3.0
  },
  "scenario_results": {
    "total_users": 100,
    "completed_flows": 95,
    "average_flow_time": "2.5s"
  },
  "current_variables": {
    "active_sessions": 87,
    "auth_tokens_refreshed": 12
  }
}
```

---

### ⚠️ GET /api/v1/simulations/:id/timeseries (NEEDS ENHANCEMENT)

**Current Status**: Basic time-series data  
**Missing Features**:

- Validation failure tracking
- Variable state over time
- Step completion rates

**Required Enhancements:**

```json
{
  "points": [
    {
      "timestamp": "2024-01-15T10:30:00Z",
      "rps": 1000,
      "target_rps": 1000,
      "response_time": 150,
      "error_rate": 2.5,
      "validation_failure_rate": 1.2,
      "active_scenarios": 50,
      "completed_steps": {
        "step1": 48,
        "step2": 45,
        "step3": 42
      }
    }
  ]
}
```

---

## 📋 **IMPLEMENTATION PRIORITY**

### Phase 1 - Critical (Week 1-2)

- [ ] POST /api/v1/configs/validate
- [ ] POST /api/v1/test-connection
- [ ] POST /api/v1/auth/test
- [ ] Enhanced POST /api/v1/simulations

### Phase 2 - High Priority (Week 3-4)

- [ ] POST /api/v1/validation/test
- [ ] GET /api/v1/validation/results/:simulationId
- [ ] POST /api/v1/scenarios
- [ ] POST /api/v1/scenarios/:id/test

### Phase 3 - Medium Priority (Week 5-6)

- [ ] POST /api/v1/data/import
- [ ] GET /api/v1/data/pools
- [ ] POST /api/v1/auth/refresh
- [ ] Enhanced existing endpoints

### Phase 4 - Advanced Features (Week 7-8)

- [ ] POST /api/v1/reports/generate
- [ ] GET /api/v1/reports/:id/download
- [ ] GET /api/v1/analytics/trends

---

## 🔧 **BACKEND IMPLEMENTATION TASKS**

### Router Configuration Updates Required

```go
// Add to cmd/main.go setupRoutes()

// Authentication & Security
api.POST("/auth/test", authHandlers.TestAuth)
api.POST("/auth/refresh", authHandlers.RefreshToken)
api.GET("/auth/types", authHandlers.GetAuthTypes)

// Configuration & Validation
api.POST("/configs/validate", simEngine.ValidateConfiguration)
api.POST("/test-connection", simEngine.TestConnection)
api.POST("/validation/test", validationHandlers.TestValidation)
api.GET("/validation/results/:simulationId", validationHandlers.GetResults)

// Scenarios
scenarios := api.Group("/scenarios")
{
    scenarios.POST("", scenarioHandlers.CreateScenario)
    scenarios.GET("", scenarioHandlers.ListScenarios)
    scenarios.GET("/:id", scenarioHandlers.GetScenario)
    scenarios.PUT("/:id", scenarioHandlers.UpdateScenario)
    scenarios.DELETE("/:id", scenarioHandlers.DeleteScenario)
    scenarios.POST("/:id/test", scenarioHandlers.TestScenario)
    scenarios.POST("/:id/simulate", scenarioHandlers.RunScenarioSimulation)
}

// Data Management
data := api.Group("/data")
{
    data.POST("/import", dataHandlers.ImportData)
    data.GET("/pools", dataHandlers.ListDataPools)
    data.GET("/pools/:id", dataHandlers.GetDataPool)
}

// Advanced Reporting
reports := api.Group("/reports")
{
    reports.POST("/generate", reportHandlers.GenerateReport)
    reports.GET("/:id", reportHandlers.GetReport)
    reports.GET("/:id/download", reportHandlers.DownloadReport)
}

// Analytics
analytics := api.Group("/analytics")
{
    analytics.GET("/trends", analyticsHandlers.GetTrends)
    analytics.GET("/insights", analyticsHandlers.GetInsights)
}
```

### Handler Files to Create

```
internal/api/auth_handlers.go
internal/api/validation_handlers.go
internal/api/scenario_handlers.go
internal/api/data_handlers.go
internal/api/report_handlers.go
internal/api/analytics_handlers.go
```

---

> **Delete each completed API endpoint from this file to track implementation progress**
