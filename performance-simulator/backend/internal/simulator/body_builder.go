package simulator

import (
	"bytes"
	"fmt"
	"io"
	"mime/multipart"
	"net/url"
	"strings"
)

// buildRequestBody builds the appropriate request body based on the body type
func (e *Engine) buildRequestBody(config *SimulationConfig) (io.Reader, string, error) {
	if config.Body == nil {
		return nil, "", nil
	}

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

// buildMultipartBody builds a multipart form data body
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

// buildFormData builds URL-encoded form data
func (e *Engine) buildFormData(formData map[string]string) string {
	data := url.Values{}
	for key, value := range formData {
		data.Set(key, value)
	}
	return data.Encode()
}

// getContentType determines the appropriate Content-Type header for the request
func (e *Engine) getContentType(bodyType BodyType, customContentType string) string {
	switch bodyType {
	case BodyTypeJSON:
		return "application/json"
	case BodyTypeForm:
		return "application/x-www-form-urlencoded"
	case BodyTypeXML:
		return "application/xml"
	case BodyTypeRaw:
		if customContentType != "" {
			return customContentType
		}
		return "text/plain"
	case BodyTypeMultipart:
		// This will be set by the multipart writer
		return ""
	default:
		return ""
	}
}

// validateBody validates the request body configuration
func (e *Engine) validateBody(config *SimulationConfig) error {
	if config.Body == nil {
		return nil
	}

	switch config.Body.Type {
	case BodyTypeNone:
		return nil

	case BodyTypeJSON:
		if config.Body.Content == "" {
			return fmt.Errorf("JSON body content cannot be empty")
		}
		// TODO: Add JSON validation if needed
		return nil

	case BodyTypeForm:
		if len(config.Body.FormData) == 0 && config.Body.Content == "" {
			return fmt.Errorf("form body must have either form data or content")
		}
		return nil

	case BodyTypeMultipart:
		if len(config.Body.FormData) == 0 && len(config.Body.Files) == 0 {
			return fmt.Errorf("multipart body must have either form data or files")
		}
		return nil

	case BodyTypeRaw:
		if config.Body.Content == "" {
			return fmt.Errorf("raw body content cannot be empty")
		}
		return nil

	case BodyTypeXML:
		if config.Body.Content == "" {
			return fmt.Errorf("XML body content cannot be empty")
		}
		// TODO: Add XML validation if needed
		return nil

	default:
		return fmt.Errorf("unsupported body type: %s", config.Body.Type)
	}
}
