package simulator

import (
	"fmt"
	"math/rand"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
)

// VariableResolver handles dynamic variable substitution in request bodies and headers
type VariableResolver struct {
	variables map[string]string
	functions map[string]func() string
}

// NewVariableResolver creates a new variable resolver with default functions
func NewVariableResolver() *VariableResolver {
	vr := &VariableResolver{
		variables: make(map[string]string),
		functions: make(map[string]func() string),
	}

	// Register default functions
	vr.registerDefaultFunctions()
	return vr
}

// registerDefaultFunctions registers built-in variable functions
func (vr *VariableResolver) registerDefaultFunctions() {
	// Random generators
	vr.functions["random_int"] = func() string {
		return strconv.Itoa(rand.Intn(1000000))
	}

	vr.functions["random_string"] = func() string {
		const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
		b := make([]byte, 10)
		for i := range b {
			b[i] = charset[rand.Intn(len(charset))]
		}
		return string(b)
	}

	vr.functions["random_email"] = func() string {
		domains := []string{"gmail.com", "yahoo.com", "hotmail.com", "example.com", "test.org"}
		username := vr.functions["random_string"]()
		domain := domains[rand.Intn(len(domains))]
		return fmt.Sprintf("%s@%s", strings.ToLower(username), domain)
	}

	vr.functions["random_phone"] = func() string {
		return fmt.Sprintf("+1%03d%03d%04d", 
			rand.Intn(900)+100, 
			rand.Intn(900)+100, 
			rand.Intn(10000))
	}

	vr.functions["random_bool"] = func() string {
		if rand.Float32() > 0.5 {
			return "true"
		}
		return "false"
	}

	vr.functions["random_float"] = func() string {
		return fmt.Sprintf("%.2f", rand.Float64()*100)
	}

	// Time-based functions
	vr.functions["timestamp"] = func() string {
		return strconv.FormatInt(time.Now().Unix(), 10)
	}

	vr.functions["timestamp_ms"] = func() string {
		return strconv.FormatInt(time.Now().UnixMilli(), 10)
	}

	vr.functions["iso_timestamp"] = func() string {
		return time.Now().Format(time.RFC3339)
	}

	vr.functions["date"] = func() string {
		return time.Now().Format("2006-01-02")
	}

	vr.functions["time"] = func() string {
		return time.Now().Format("15:04:05")
	}

	vr.functions["datetime"] = func() string {
		return time.Now().Format("2006-01-02 15:04:05")
	}

	// UUID functions
	vr.functions["uuid"] = func() string {
		return uuid.New().String()
	}

	vr.functions["uuid_short"] = func() string {
		return strings.ReplaceAll(uuid.New().String(), "-", "")
	}

	// Name generators
	vr.functions["first_name"] = func() string {
		names := []string{"John", "Jane", "Michael", "Sarah", "David", "Lisa", "Robert", "Emily", 
						  "James", "Anna", "Christopher", "Jessica", "Matthew", "Ashley", "Daniel", "Amanda"}
		return names[rand.Intn(len(names))]
	}

	vr.functions["last_name"] = func() string {
		names := []string{"Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
						  "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas"}
		return names[rand.Intn(len(names))]
	}

	vr.functions["full_name"] = func() string {
		return fmt.Sprintf("%s %s", vr.functions["first_name"](), vr.functions["last_name"]())
	}

	vr.functions["username"] = func() string {
		firstName := strings.ToLower(vr.functions["first_name"]())
		lastName := strings.ToLower(vr.functions["last_name"]())
		number := rand.Intn(9999)
		return fmt.Sprintf("%s.%s%d", firstName, lastName, number)
	}

	// Company/Business generators
	vr.functions["company"] = func() string {
		companies := []string{"TechCorp", "DataSystems", "CloudWorks", "InnovateLab", "DevHub",
							  "CodeCraft", "SystemPro", "NetSolutions", "WebForge", "AppFactory"}
		return companies[rand.Intn(len(companies))]
	}

	vr.functions["domain"] = func() string {
		company := strings.ToLower(vr.functions["company"]())
		extensions := []string{".com", ".org", ".net", ".io", ".co"}
		return company + extensions[rand.Intn(len(extensions))]
	}

	// Geographic data
	vr.functions["country"] = func() string {
		countries := []string{"USA", "Canada", "UK", "Germany", "France", "Japan", "Australia", "Brazil"}
		return countries[rand.Intn(len(countries))]
	}

	vr.functions["city"] = func() string {
		cities := []string{"New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia",
						   "San Antonio", "San Diego", "Dallas", "San Jose", "Austin", "Jacksonville"}
		return cities[rand.Intn(len(cities))]
	}

	vr.functions["zipcode"] = func() string {
		return fmt.Sprintf("%05d", rand.Intn(99999))
	}

	// Status and categories
	vr.functions["status"] = func() string {
		statuses := []string{"active", "inactive", "pending", "completed", "failed", "processing"}
		return statuses[rand.Intn(len(statuses))]
	}

	vr.functions["priority"] = func() string {
		priorities := []string{"low", "medium", "high", "critical"}
		return priorities[rand.Intn(len(priorities))]
	}

	vr.functions["category"] = func() string {
		categories := []string{"technology", "business", "finance", "healthcare", "education", "retail"}
		return categories[rand.Intn(len(categories))]
	}
}

// SetVariable sets a static variable value
func (vr *VariableResolver) SetVariable(key, value string) {
	vr.variables[key] = value
}

// SetFunction sets a custom function for dynamic value generation
func (vr *VariableResolver) SetFunction(key string, fn func() string) {
	vr.functions[key] = fn
}

// Resolve replaces all variables in the input content
func (vr *VariableResolver) Resolve(content string) string {
	// Pattern to match {{variable}} syntax
	re := regexp.MustCompile(`\{\{([^}]+)\}\}`)
	
	return re.ReplaceAllStringFunc(content, func(match string) string {
		varName := strings.Trim(match, "{}")
		varName = strings.TrimSpace(varName)

		// Check static variables first
		if value, exists := vr.variables[varName]; exists {
			return value
		}

		// Check dynamic functions
		if fn, exists := vr.functions[varName]; exists {
			return fn()
		}

		// Return original if not found
		return match
	})
}

// ResolveHeaders resolves variables in HTTP headers
func (vr *VariableResolver) ResolveHeaders(headers map[string]string) map[string]string {
	resolved := make(map[string]string)
	for key, value := range headers {
		resolvedKey := vr.Resolve(key)
		resolvedValue := vr.Resolve(value)
		resolved[resolvedKey] = resolvedValue
	}
	return resolved
}

// ResolveBody resolves variables in request body
func (vr *VariableResolver) ResolveBody(body *RequestBody) *RequestBody {
	if body == nil {
		return nil
	}

	resolvedBody := &RequestBody{
		Type: body.Type,
	}

	// Resolve content
	resolvedBody.Content = vr.Resolve(body.Content)

	// Resolve form data
	if body.FormData != nil {
		resolvedBody.FormData = make(map[string]string)
		for key, value := range body.FormData {
			resolvedKey := vr.Resolve(key)
			resolvedValue := vr.Resolve(value)
			resolvedBody.FormData[resolvedKey] = resolvedValue
		}
	}

	// Copy files (no variable resolution in binary data)
	resolvedBody.Files = body.Files

	return resolvedBody
}

// GetAvailableVariables returns a list of all available variable names
func (vr *VariableResolver) GetAvailableVariables() map[string]string {
	variables := make(map[string]string)
	
	// Add static variables
	for key, value := range vr.variables {
		variables[key] = value
	}
	
	// Add function names (with sample values)
	for key, fn := range vr.functions {
		variables[key] = fn() // Generate sample value
	}
	
	return variables
}
