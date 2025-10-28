// Simulation Configuration Types for Frontend

export type HttpMethod = 
  | "GET" 
  | "POST" 
  | "PUT" 
  | "DELETE" 
  | "PATCH" 
  | "HEAD" 
  | "OPTIONS";

export type BodyType = 
  | "none" 
  | "json" 
  | "form" 
  | "multipart" 
  | "raw" 
  | "xml";

export type AuthType = 
  | "none" 
  | "bearer" 
  | "basic" 
  | "apikey" 
  | "custom";

export type LoadPattern = 
  | "constant"
  | "linear_ramp" 
  | "exponential"
  | "spike"
  | "sine_wave"
  | "step_ramp"
  | "mega_scale"
  | "logarithmic";

export type ScaleMode = 
  | "linear"
  | "logarithmic" 
  | "exponential"
  | "step";

export interface SimulationConfigForm {
  name: string;
  description?: string;
  targetUrl: string;
  method: HttpMethod;
  timeout: number; // seconds
}

export interface RequestBody {
  type: BodyType;
  content: string;
  contentType?: string;
}

export interface RequestConfig {
  headers: Record<string, string>;
  queryParams: Record<string, string>;
  body: RequestBody;
}

export interface APIKeyAuth {
  key: string;
  value: string;
  location: "header" | "query";
}

export interface AuthConfig {
  type: AuthType;
  token?: string;
  username?: string;
  password?: string;
  apiKey?: APIKeyAuth;
  customHeaders?: Record<string, string>;
}

export interface LoadConfig {
  pattern: LoadPattern;
  scaleMode: ScaleMode;
  minRps: number;
  maxRps: number;
  duration: number; // minutes
  concurrentUsers: number;
  rampUpTime: number; // seconds
}

export interface ValidationRule {
  type: "status_code" | "response_time" | "body_content" | "header";
  field?: string;
  operator: "equals" | "not_equals" | "contains" | "gt" | "lt" | "exists";
  value: string | number;
  enabled: boolean;
}

export interface ValidationConfig {
  enabled: boolean;
  rules: ValidationRule[];
  expectedStatusCodes: number[];
  maxResponseTime?: number; // milliseconds
}

export interface CompleteSimulationConfig extends SimulationConfigForm {
  request: RequestConfig;
  auth: AuthConfig;
  load: LoadConfig;
  validation: ValidationConfig;
}

// API Response Types
export interface ConfigValidationResponse {
  valid: boolean;
  errors: string[];
  warnings: string[];
  estimatedResources?: {
    memoryMb: number;
    cpuCores: number;
    networkMbps: number;
  };
}

export interface TestConnectionResponse {
  success: boolean;
  statusCode?: number;
  responseTime?: string;
  responseSize?: number;
  sslInfo?: {
    valid: boolean;
    expires: string;
    issuer: string;
  };
  dnsResolutionTime?: string;
  connectionTime?: string;
  error?: string;
}

// UI State Types
export interface FormErrors {
  [key: string]: string | undefined;
}

export interface FormTouched {
  [key: string]: boolean;
}

export interface ConfigTemplate {
  id: string;
  name: string;
  description: string;
  category: "api" | "website" | "microservice" | "database";
  config: Partial<CompleteSimulationConfig>;
}

// Load Pattern Descriptions
export const LOAD_PATTERN_DESCRIPTIONS: Record<LoadPattern, string> = {
  constant: "Maintains a steady rate of requests throughout the test duration.",
  linear_ramp: "Gradually increases from minimum to maximum RPS over the ramp-up time.",
  exponential: "Starts slow and rapidly accelerates, useful for finding breaking points.",
  spike: "Sudden increase to maximum load in the middle of the test duration.",
  sine_wave: "Oscillating load pattern that cycles between low and high traffic.",
  step_ramp: "Increases load in discrete steps rather than continuous ramp.",
  mega_scale: "Specialized pattern for testing from 1 RPS to millions/second.",
  logarithmic: "Slow start with rapid acceleration, ideal for gradual scaling tests."
};

// Scale Mode Descriptions
export const SCALE_MODE_DESCRIPTIONS: Record<ScaleMode, string> = {
  linear: "RPS increases steadily from min to max over the duration.",
  logarithmic: "RPS starts slow and accelerates rapidly, ideal for 1 RPS to millions.",
  exponential: "RPS has rapid early growth, then gradually increases.",
  step: "RPS increases in powers of 10 (1, 10, 100, 1K, 10K, 100K, 1M)."
};

// Default configurations
export const DEFAULT_CONFIG: CompleteSimulationConfig = {
  name: "",
  description: "",
  targetUrl: "",
  method: "GET",
  timeout: 30,
  request: {
    headers: {},
    queryParams: {},
    body: {
      type: "none",
      content: "",
    },
  },
  auth: {
    type: "none",
  },
  load: {
    pattern: "linear_ramp",
    scaleMode: "linear",
    minRps: 1,
    maxRps: 100,
    duration: 5,
    concurrentUsers: 10,
    rampUpTime: 60,
  },
  validation: {
    enabled: false,
    rules: [],
    expectedStatusCodes: [200],
  },
};

// Template configurations
export const CONFIG_TEMPLATES: ConfigTemplate[] = [
  {
    id: "rest_api",
    name: "REST API Test",
    description: "Standard REST API performance test",
    category: "api",
    config: {
      method: "GET",
      timeout: 10,
      load: {
        pattern: "linear_ramp",
        scaleMode: "linear",
        minRps: 1,
        maxRps: 1000,
        duration: 5,
        concurrentUsers: 50,
        rampUpTime: 60,
      },
      validation: {
        enabled: true,
        rules: [],
        expectedStatusCodes: [200, 201],
        maxResponseTime: 500,
      },
    },
  },
  {
    id: "microservice_load",
    name: "Microservice Load Test",
    description: "High-throughput microservice testing",
    category: "microservice",
    config: {
      method: "POST",
      timeout: 5,
      load: {
        pattern: "exponential",
        scaleMode: "exponential",
        minRps: 1,
        maxRps: 10000,
        duration: 10,
        concurrentUsers: 500,
        rampUpTime: 120,
      },
      request: {
        headers: {
          "Content-Type": "application/json",
        },
        queryParams: {},
        body: {
          type: "json",
          content: '{"test": true}',
        },
      },
    },
  },
  {
    id: "stress_test",
    name: "Stress Test",
    description: "Find breaking point with mega-scale testing",
    category: "api",
    config: {
      load: {
        pattern: "mega_scale",
        scaleMode: "logarithmic",
        minRps: 1,
        maxRps: 100000,
        duration: 15,
        concurrentUsers: 1000,
        rampUpTime: 300,
      },
    },
  },
];
