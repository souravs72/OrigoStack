package simulator

import (
	"bytes"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"sync"
	"time"
)

// AuthManager handles authentication for HTTP requests
type AuthManager struct {
	configs map[int64]*AuthConfig
	tokens  map[int64]*TokenCache
	mutex   sync.RWMutex
}

// TokenCache represents cached authentication tokens
type TokenCache struct {
	AccessToken  string
	RefreshToken string
	ExpiresAt    int64
}

// NewAuthManager creates a new authentication manager
func NewAuthManager() *AuthManager {
	return &AuthManager{
		configs: make(map[int64]*AuthConfig),
		tokens:  make(map[int64]*TokenCache),
	}
}

// SetAuthConfig sets authentication configuration for a simulation
func (am *AuthManager) SetAuthConfig(simulationID int64, config *AuthConfig) {
	am.mutex.Lock()
	defer am.mutex.Unlock()
	am.configs[simulationID] = config
}

// ApplyAuth applies authentication to an HTTP request
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

// applyBearerAuth applies bearer token authentication
func (am *AuthManager) applyBearerAuth(req *http.Request, auth *BearerAuth) error {
	if auth == nil || auth.Token == "" {
		return fmt.Errorf("bearer token is required")
	}

	req.Header.Set("Authorization", "Bearer "+auth.Token)
	return nil
}

// applyBasicAuth applies basic authentication
func (am *AuthManager) applyBasicAuth(req *http.Request, auth *BasicAuth) error {
	if auth == nil || auth.Username == "" || auth.Password == "" {
		return fmt.Errorf("username and password are required for basic auth")
	}

	credentials := auth.Username + ":" + auth.Password
	encoded := base64.StdEncoding.EncodeToString([]byte(credentials))
	req.Header.Set("Authorization", "Basic "+encoded)
	return nil
}

// applyAPIKeyAuth applies API key authentication
func (am *AuthManager) applyAPIKeyAuth(req *http.Request, auth *APIKeyAuth) error {
	if auth == nil || auth.Key == "" || auth.Value == "" {
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

// applyJWTAuth applies JWT authentication with token refresh support
func (am *AuthManager) applyJWTAuth(req *http.Request, simulationID int64, auth *JWTAuth) error {
	am.mutex.Lock()
	defer am.mutex.Unlock()

	// Check if token needs refresh
	if cached, exists := am.tokens[simulationID]; exists {
		if cached.ExpiresAt > 0 && time.Now().Unix() >= cached.ExpiresAt-60 { // Refresh 1 minute before expiry
			// Token is expired or about to expire, refresh it
			if auth.RefreshToken != "" && auth.RefreshURL != "" {
				newToken, expiresAt, err := am.refreshJWTToken(auth)
				if err != nil {
					return fmt.Errorf("failed to refresh JWT token: %v", err)
				}

				// Cache the new token
				am.tokens[simulationID] = &TokenCache{
					AccessToken:  newToken,
					RefreshToken: auth.RefreshToken,
					ExpiresAt:    expiresAt,
				}

				req.Header.Set("Authorization", "Bearer "+newToken)
				return nil
			}
		} else {
			// Use cached token
			req.Header.Set("Authorization", "Bearer "+cached.AccessToken)
			return nil
		}
	}

	// Use static token
	if auth.Token == "" {
		return fmt.Errorf("JWT token is required")
	}

	req.Header.Set("Authorization", "Bearer "+auth.Token)

	// Cache the token if expiry is specified
	if auth.ExpiresAt > 0 {
		am.tokens[simulationID] = &TokenCache{
			AccessToken:  auth.Token,
			RefreshToken: auth.RefreshToken,
			ExpiresAt:    auth.ExpiresAt,
		}
	}

	return nil
}

// applyOAuth2Auth applies OAuth2 client credentials authentication
func (am *AuthManager) applyOAuth2Auth(req *http.Request, simulationID int64, auth *OAuth2Auth) error {
	am.mutex.Lock()
	defer am.mutex.Unlock()

	// Check if we have a cached, valid token
	if cached, exists := am.tokens[simulationID]; exists {
		if cached.ExpiresAt == 0 || time.Now().Unix() < cached.ExpiresAt-60 { // Token still valid
			req.Header.Set("Authorization", "Bearer "+cached.AccessToken)
			return nil
		}
	}

	// Need to get a new token
	token, expiresAt, err := am.getOAuth2Token(auth)
	if err != nil {
		return fmt.Errorf("failed to get OAuth2 token: %v", err)
	}

	// Cache the new token
	am.tokens[simulationID] = &TokenCache{
		AccessToken: token,
		ExpiresAt:   expiresAt,
	}

	req.Header.Set("Authorization", "Bearer "+token)
	return nil
}

// refreshJWTToken refreshes a JWT token using the refresh token
func (am *AuthManager) refreshJWTToken(auth *JWTAuth) (string, int64, error) {
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

// getOAuth2Token gets an OAuth2 access token using client credentials
func (am *AuthManager) getOAuth2Token(auth *OAuth2Auth) (string, int64, error) {
	payload := map[string]string{
		"grant_type":    "client_credentials",
		"client_id":     auth.ClientID,
		"client_secret": auth.ClientSecret,
	}

	if auth.Scope != "" {
		payload["scope"] = auth.Scope
	}

	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return "", 0, err
	}

	resp, err := http.Post(auth.TokenURL, "application/json", bytes.NewBuffer(jsonPayload))
	if err != nil {
		return "", 0, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", 0, fmt.Errorf("OAuth2 token request failed with status: %d", resp.StatusCode)
	}

	var result struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int64  `json:"expires_in"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", 0, err
	}

	var expiresAt int64
	if result.ExpiresIn > 0 {
		expiresAt = time.Now().Unix() + result.ExpiresIn
	}

	return result.AccessToken, expiresAt, nil
}

// CreateHTTPClientWithAuth creates an HTTP client with client certificate authentication if needed
func (am *AuthManager) CreateHTTPClientWithAuth(config *AuthConfig) (*http.Client, error) {
	client := &http.Client{
		Timeout: 30 * time.Second,
	}

	if config != nil && config.Type == AuthTypeClientCert && config.ClientCert != nil {
		tlsConfig, err := am.loadClientCertificate(config.ClientCert)
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

// loadClientCertificate loads client certificate for mutual TLS authentication
func (am *AuthManager) loadClientCertificate(auth *ClientCertAuth) (*tls.Config, error) {
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

// ClearAuthConfig removes authentication configuration for a simulation
func (am *AuthManager) ClearAuthConfig(simulationID int64) {
	am.mutex.Lock()
	defer am.mutex.Unlock()
	delete(am.configs, simulationID)
	delete(am.tokens, simulationID)
}
