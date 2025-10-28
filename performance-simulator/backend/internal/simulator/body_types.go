package simulator

// Request body types and structures for enhanced HTTP client support

// BodyType defines different types of request bodies
type BodyType string

const (
	BodyTypeNone      BodyType = "none"
	BodyTypeJSON      BodyType = "json"
	BodyTypeForm      BodyType = "form"
	BodyTypeMultipart BodyType = "multipart"
	BodyTypeRaw       BodyType = "raw"
	BodyTypeXML       BodyType = "xml"
)

// RequestBody represents the structure of a request body
type RequestBody struct {
	Type     BodyType              `json:"type"`
	Content  string                `json:"content"`
	Files    []FileUpload          `json:"files,omitempty"`
	FormData map[string]string     `json:"form_data,omitempty"`
}

// FileUpload represents a file to be uploaded in multipart requests
type FileUpload struct {
	FieldName string `json:"field_name"`
	FileName  string `json:"file_name"`
	Content   []byte `json:"content"`
	MimeType  string `json:"mime_type"`
}

// AuthConfig represents authentication configuration
type AuthConfig struct {
	Type         AuthType          `json:"type"`
	BearerToken  *BearerAuth      `json:"bearer_token,omitempty"`
	BasicAuth    *BasicAuth       `json:"basic_auth,omitempty"`
	APIKey       *APIKeyAuth      `json:"api_key,omitempty"`
	JWT          *JWTAuth         `json:"jwt,omitempty"`
	OAuth2       *OAuth2Auth      `json:"oauth2,omitempty"`
	ClientCert   *ClientCertAuth  `json:"client_cert,omitempty"`
}

// AuthType defines different authentication methods
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

// BearerAuth represents Bearer token authentication
type BearerAuth struct {
	Token string `json:"token"`
}

// BasicAuth represents basic username/password authentication
type BasicAuth struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// APIKeyAuth represents API key authentication
type APIKeyAuth struct {
	Key      string `json:"key"`
	Value    string `json:"value"`
	Location string `json:"location"` // "header" or "query"
}

// JWTAuth represents JWT token authentication with refresh capability
type JWTAuth struct {
	Token        string `json:"token"`
	RefreshToken string `json:"refresh_token,omitempty"`
	RefreshURL   string `json:"refresh_url,omitempty"`
	ExpiresAt    int64  `json:"expires_at,omitempty"`
}

// OAuth2Auth represents OAuth2 client credentials authentication
type OAuth2Auth struct {
	ClientID     string `json:"client_id"`
	ClientSecret string `json:"client_secret"`
	TokenURL     string `json:"token_url"`
	Scope        string `json:"scope,omitempty"`
	AccessToken  string `json:"access_token,omitempty"`
	ExpiresAt    int64  `json:"expires_at,omitempty"`
}

// ClientCertAuth represents client certificate authentication
type ClientCertAuth struct {
	CertFile string `json:"cert_file"`
	KeyFile  string `json:"key_file"`
	CAFile   string `json:"ca_file,omitempty"`
}
