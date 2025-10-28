# Critical Features - Detailed Specifications

> **Instructions**: Delete each feature specification after implementation is complete

---


## 🔴 **FEATURE 2: Request Body Support - Backend**

### Overview

Extend the HTTP client to support all types of request bodies with proper Content-Type handling.

### Current State

```go
// Current: Basic implementation only
req, err := http.NewRequestWithContext(sim.ctx, sim.config.Method, sim.config.TargetURL, nil)
```

### Required Implementation

#### 2.1 Enhanced SimulationConfig Structure

```go
type SimulationConfig struct {
    // ... existing fields ...
    Body        RequestBody       `json:"body"`
    ContentType string           `json:"content_type"`
}

type RequestBody struct {
    Type    BodyType `json:"type"`
    Content string   `json:"content"`
    Files   []FileUpload `json:"files,omitempty"`
    FormData map[string]string `json:"form_data,omitempty"`
}

type BodyType string
const (
    BodyTypeNone      BodyType = "none"
    BodyTypeJSON      BodyType = "json"
    BodyTypeForm      BodyType = "form"
    BodyTypeMultipart BodyType = "multipart"
    BodyTypeRaw       BodyType = "raw"
    BodyTypeXML       BodyType = "xml"
)

type FileUpload struct {
    FieldName string `json:"field_name"`
    FileName  string `json:"file_name"`
    Content   []byte `json:"content"`
    MimeType  string `json:"mime_type"`
}
```

#### 2.2 Request Body Builder Function

```go
func (e *Engine) buildRequestBody(config *SimulationConfig) (io.Reader, string, error) {
    switch config.Body.Type {
    case BodyTypeNone:
        return nil, "", nil

    case BodyTypeJSON:
        body := strings.NewReader(config.Body.Content)
        return body, "application/json", nil

    case BodyTypeForm:
        data := url.Values{}
        for key, value := range config.Body.FormData {
            data.Set(key, value)
        }
        body := strings.NewReader(data.Encode())
        return body, "application/x-www-form-urlencoded", nil

    case BodyTypeMultipart:
        return e.buildMultipartBody(config)

    case BodyTypeRaw:
        body := strings.NewReader(config.Body.Content)
        contentType := config.ContentType
        if contentType == "" {
            contentType = "text/plain"
        }
        return body, contentType, nil

    case BodyTypeXML:
        body := strings.NewReader(config.Body.Content)
        return body, "application/xml", nil

    default:
        return nil, "", fmt.Errorf("unsupported body type: %s", config.Body.Type)
    }
}
```

#### 2.3 Multipart Form Data Handler

```go
func (e *Engine) buildMultipartBody(config *SimulationConfig) (io.Reader, string, error) {
    var buf bytes.Buffer
    writer := multipart.NewWriter(&buf)

    // Add form fields
    for key, value := range config.Body.FormData {
        err := writer.WriteField(key, value)
        if err != nil {
            return nil, "", err
        }
    }

    // Add files
    for _, file := range config.Body.Files {
        part, err := writer.CreateFormFile(file.FieldName, file.FileName)
        if err != nil {
            return nil, "", err
        }

        _, err = part.Write(file.Content)
        if err != nil {
            return nil, "", err
        }
    }

    err := writer.Close()
    if err != nil {
        return nil, "", err
    }

    return &buf, writer.FormDataContentType(), nil
}
```

#### 2.4 Variable Substitution Engine

```go
type VariableResolver struct {
    variables map[string]string
    functions map[string]func() string
}

func (vr *VariableResolver) Resolve(content string) string {
    // Replace {{variable}} with actual values
    re := regexp.MustCompile(`\{\{([^}]+)\}\}`)
    return re.ReplaceAllStringFunc(content, func(match string) string {
        varName := strings.Trim(match, "{}")

        // Check static variables first
        if value, exists := vr.variables[varName]; exists {
            return value
        }

        // Check dynamic functions
        if fn, exists := vr.functions[varName]; exists {
            return fn()
        }

        return match // Return original if not found
    })
}

// Built-in variable functions
func (vr *VariableResolver) registerBuiltins() {
    vr.functions["timestamp"] = func() string {
        return strconv.FormatInt(time.Now().Unix(), 10)
    }
    vr.functions["uuid"] = func() string {
        return uuid.New().String()
    }
    vr.functions["random_int"] = func() string {
        return strconv.Itoa(rand.Intn(10000))
    }
}
```

#### 2.5 Enhanced Request Execution

```go
func (e *Engine) executeRequest(sim *Simulation, workerPool <-chan struct{}, wg *sync.WaitGroup) {
    defer func() {
        <-workerPool
        wg.Done()
    }()

    startTime := time.Now()

    // Build request body
    body, contentType, err := e.buildRequestBody(sim.config)
    if err != nil {
        atomic.AddInt64(&sim.errorCount, 1)
        logrus.Errorf("Failed to build request body: %v", err)
        return
    }

    // Create HTTP request with body
    req, err := http.NewRequestWithContext(sim.ctx, sim.config.Method, sim.config.TargetURL, body)
    if err != nil {
        atomic.AddInt64(&sim.errorCount, 1)
        return
    }

    // Set Content-Type if body is present
    if body != nil && contentType != "" {
        req.Header.Set("Content-Type", contentType)
    }

    // Add custom headers
    for key, value := range sim.config.Headers {
        req.Header.Set(key, value)
    }

    // Execute request
    resp, err := sim.client.Do(req)
    responseTime := time.Since(startTime)

    // ... rest of execution logic
}
```

### API Endpoints to Add

```go
// Add to main.go routes
api.POST("/test-connection", simEngine.TestConnection)
api.POST("/validate-body", simEngine.ValidateRequestBody)
```

### Implementation Files to Create/Modify

#### Backend Files

```
internal/simulator/body_builder.go       (new)
internal/simulator/variable_resolver.go  (new)
internal/simulator/engine.go             (modify executeRequest)
internal/simulator/validation.go         (enhance)
```

### Acceptance Criteria

- [ ] JSON request bodies work with proper Content-Type
- [ ] Form-encoded data (application/x-www-form-urlencoded) support
- [ ] Multipart form data with file upload capability
- [ ] Raw text and XML body support
- [ ] Variable substitution works with {{variable}} syntax
- [ ] Built-in variables (timestamp, uuid, random) available
- [ ] Content-Type headers set automatically based on body type
- [ ] Large request body handling (streaming)
- [ ] Body validation before test execution
- [ ] Error handling for malformed bodies

### Testing Requirements

- [ ] Unit tests for each body type builder
- [ ] Integration tests with real HTTP server
- [ ] Variable substitution testing
- [ ] File upload testing with different file types
- [ ] Performance testing with large bodies
- [ ] Error case testing (malformed JSON, etc.)

---

## 🔴 **FEATURE 3: Authentication & Security Implementation**

### Overview

Implement comprehensive authentication methods for testing secured APIs.

### Current State

```go
// Current: Only custom headers support
for key, value := range sim.config.Headers {
    req.Header.Set(key, value)
}
```

### Required Implementation

#### 3.1 Authentication Configuration Structure

```go
type AuthConfig struct {
    Type         AuthType          `json:"type"`
    BearerToken  *BearerAuth      `json:"bearer_token,omitempty"`
    BasicAuth    *BasicAuth       `json:"basic_auth,omitempty"`
    APIKey       *APIKeyAuth      `json:"api_key,omitempty"`
    JWT          *JWTAuth         `json:"jwt,omitempty"`
    OAuth2       *OAuth2Auth      `json:"oauth2,omitempty"`
    ClientCert   *ClientCertAuth  `json:"client_cert,omitempty"`
}

type AuthType string
const (
    AuthTypeNone       AuthType = "none"
    AuthTypeBearer     AuthType = "bearer"
    AuthTypeBasic      AuthType = "basic"
    AuthTypeAPIKey     AuthType = "apikey"
    AuthTypeJWT        AuthType = "jwt"
    AuthTypeOAuth2     AuthType = "oauth2"
    AuthTypeClientCert AuthType = "client_cert"
)

type BearerAuth struct {
    Token string `json:"token"`
}

type BasicAuth struct {
    Username string `json:"username"`
    Password string `json:"password"`
}

type APIKeyAuth struct {
    Key      string `json:"key"`
    Value    string `json:"value"`
    Location string `json:"location"` // "header" or "query"
}

type JWTAuth struct {
    Token        string `json:"token"`
    RefreshToken string `json:"refresh_token,omitempty"`
    RefreshURL   string `json:"refresh_url,omitempty"`
    ExpiresAt    int64  `json:"expires_at,omitempty"`
}

type OAuth2Auth struct {
    ClientID     string `json:"client_id"`
    ClientSecret string `json:"client_secret"`
    TokenURL     string `json:"token_url"`
    Scope        string `json:"scope,omitempty"`
    AccessToken  string `json:"access_token,omitempty"`
    ExpiresAt    int64  `json:"expires_at,omitempty"`
}

type ClientCertAuth struct {
    CertFile string `json:"cert_file"`
    KeyFile  string `json:"key_file"`
    CAFile   string `json:"ca_file,omitempty"`
}
```

#### 3.2 Authentication Manager

```go
type AuthManager struct {
    configs map[int64]*AuthConfig
    tokens  map[int64]*TokenCache
    mutex   sync.RWMutex
}

type TokenCache struct {
    Token     string
    ExpiresAt time.Time
    RefreshToken string
}

func NewAuthManager() *AuthManager {
    return &AuthManager{
        configs: make(map[int64]*AuthConfig),
        tokens:  make(map[int64]*TokenCache),
    }
}

func (am *AuthManager) ApplyAuth(req *http.Request, simulationID int64) error {
    am.mutex.RLock()
    config, exists := am.configs[simulationID]
    am.mutex.RUnlock()

    if !exists || config.Type == AuthTypeNone {
        return nil
    }

    switch config.Type {
    case AuthTypeBearer:
        return am.applyBearerAuth(req, config.BearerToken)
    case AuthTypeBasic:
        return am.applyBasicAuth(req, config.BasicAuth)
    case AuthTypeAPIKey:
        return am.applyAPIKeyAuth(req, config.APIKey)
    case AuthTypeJWT:
        return am.applyJWTAuth(req, simulationID, config.JWT)
    case AuthTypeOAuth2:
        return am.applyOAuth2Auth(req, simulationID, config.OAuth2)
    default:
        return fmt.Errorf("unsupported auth type: %s", config.Type)
    }
}

func (am *AuthManager) applyBearerAuth(req *http.Request, auth *BearerAuth) error {
    if auth.Token == "" {
        return fmt.Errorf("bearer token is empty")
    }
    req.Header.Set("Authorization", "Bearer "+auth.Token)
    return nil
}

func (am *AuthManager) applyBasicAuth(req *http.Request, auth *BasicAuth) error {
    if auth.Username == "" || auth.Password == "" {
        return fmt.Errorf("basic auth credentials are incomplete")
    }
    req.SetBasicAuth(auth.Username, auth.Password)
    return nil
}

func (am *AuthManager) applyAPIKeyAuth(req *http.Request, auth *APIKeyAuth) error {
    if auth.Key == "" || auth.Value == "" {
        return fmt.Errorf("API key credentials are incomplete")
    }

    switch auth.Location {
    case "header":
        req.Header.Set(auth.Key, auth.Value)
    case "query":
        q := req.URL.Query()
        q.Set(auth.Key, auth.Value)
        req.URL.RawQuery = q.Encode()
    default:
        return fmt.Errorf("invalid API key location: %s", auth.Location)
    }
    return nil
}
```

#### 3.3 JWT Token Management

```go
func (am *AuthManager) applyJWTAuth(req *http.Request, simulationID int64, auth *JWTAuth) error {
    am.mutex.Lock()
    defer am.mutex.Unlock()

    // Check if token needs refresh
    if cached, exists := am.tokens[simulationID]; exists {
        if time.Now().Before(cached.ExpiresAt.Add(-5 * time.Minute)) {
            // Token is still valid (with 5min buffer)
            req.Header.Set("Authorization", "Bearer "+cached.Token)
            return nil
        }
    }

    // Refresh token if needed
    if auth.RefreshURL != "" && auth.RefreshToken != "" {
        newToken, expiresAt, err := am.refreshJWTToken(auth)
        if err != nil {
            return fmt.Errorf("failed to refresh JWT token: %v", err)
        }

        // Cache the new token
        am.tokens[simulationID] = &TokenCache{
            Token:        newToken,
            ExpiresAt:    time.Unix(expiresAt, 0),
            RefreshToken: auth.RefreshToken,
        }

        req.Header.Set("Authorization", "Bearer "+newToken)
        return nil
    }

    // Use static token
    req.Header.Set("Authorization", "Bearer "+auth.Token)
    return nil
}

func (am *AuthManager) refreshJWTToken(auth *JWTAuth) (string, int64, error) {
    // Implementation for JWT token refresh
    payload := map[string]string{
        "refresh_token": auth.RefreshToken,
    }

    jsonPayload, err := json.Marshal(payload)
    if err != nil {
        return "", 0, err
    }

    resp, err := http.Post(auth.RefreshURL, "application/json", bytes.NewBuffer(jsonPayload))
    if err != nil {
        return "", 0, err
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        return "", 0, fmt.Errorf("token refresh failed with status: %d", resp.StatusCode)
    }

    var result struct {
        AccessToken string `json:"access_token"`
        ExpiresIn   int64  `json:"expires_in"`
    }

    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return "", 0, err
    }

    expiresAt := time.Now().Unix() + result.ExpiresIn
    return result.AccessToken, expiresAt, nil
}
```

#### 3.4 Client Certificate Support

```go
func (e *Engine) createHTTPClientWithAuth(config *SimulationConfig) (*http.Client, error) {
    client := &http.Client{
        Timeout: 30 * time.Second,
    }

    if config.Auth != nil && config.Auth.Type == AuthTypeClientCert {
        tlsConfig, err := e.loadClientCertificate(config.Auth.ClientCert)
        if err != nil {
            return nil, fmt.Errorf("failed to load client certificate: %v", err)
        }

        transport := &http.Transport{
            TLSClientConfig: tlsConfig,
        }
        client.Transport = transport
    }

    return client, nil
}

func (e *Engine) loadClientCertificate(auth *ClientCertAuth) (*tls.Config, error) {
    cert, err := tls.LoadX509KeyPair(auth.CertFile, auth.KeyFile)
    if err != nil {
        return nil, err
    }

    tlsConfig := &tls.Config{
        Certificates: []tls.Certificate{cert},
    }

    if auth.CAFile != "" {
        caCert, err := ioutil.ReadFile(auth.CAFile)
        if err != nil {
            return nil, err
        }

        caCertPool := x509.NewCertPool()
        caCertPool.AppendCertsFromPEM(caCert)
        tlsConfig.RootCAs = caCertPool
    }

    return tlsConfig, nil
}
```

### Implementation Files to Create/Modify

#### Backend Files

```
internal/simulator/auth_manager.go        (new)
internal/simulator/auth_types.go          (new)
internal/simulator/engine.go              (modify)
internal/api/auth_handlers.go             (new)
```

#### Frontend Files

```
src/components/config/AuthConfig.tsx      (new)
src/types/AuthTypes.ts                    (new)
```

### API Endpoints to Add

```go
POST /api/v1/auth/test                    // Test authentication
POST /api/v1/auth/refresh                 // Refresh tokens
GET  /api/v1/auth/types                   // Available auth types
```

### Acceptance Criteria

- [ ] Bearer token authentication working
- [ ] Basic authentication (username/password) implemented
- [ ] API key authentication (header and query param)
- [ ] JWT token handling with automatic refresh
- [ ] OAuth2 client credentials flow
- [ ] Client certificate authentication
- [ ] Secure credential storage (no plaintext passwords)
- [ ] Token caching and refresh logic
- [ ] Authentication testing endpoint
- [ ] Error handling for invalid credentials

### Testing Requirements

- [ ] Unit tests for each authentication method
- [ ] Integration tests with mock auth servers
- [ ] JWT token refresh testing
- [ ] Client certificate validation
- [ ] Security testing (credential leakage prevention)
- [ ] Performance testing with auth overhead

---

> **Delete each completed feature specification from this file to track progress**
