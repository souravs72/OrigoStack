# Build stage
FROM golang:1.18-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git ca-certificates tzdata

# Copy go mod and sum files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -ldflags '-extldflags "-static"' -o main cmd/main.go

# Final stage
FROM alpine:3.18

# Install minimal requirements
RUN apk --no-cache add ca-certificates tzdata

# Set working directory
WORKDIR /app

# Copy binary from builder stage  
COPY --from=builder /app/main .

# Expose port
EXPOSE 8080

# Run the application
CMD ["/app/main"]
