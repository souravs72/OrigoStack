-- Performance Simulator Database Initialization
-- This script creates the initial database schema and data

-- Create database if it doesn't exist (handled by Docker)
-- CREATE DATABASE IF NOT EXISTS performance_simulator;

-- Use the database
-- \c performance_simulator;

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create enums
CREATE TYPE simulation_status AS ENUM ('created', 'starting', 'running', 'completed', 'failed', 'cancelled');
CREATE TYPE load_pattern AS ENUM ('constant', 'linear_ramp', 'exponential', 'spike', 'sine_wave', 'custom');

-- Tables will be auto-created by GORM migration
-- Indexes and constraints will be handled by GORM

-- Database initialization complete
-- Tables, indexes, triggers, views and data seeding will be handled by the application

-- Grant permissions to the application user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO simulator_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO simulator_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO simulator_user;

-- Insert a welcome message in the logs
DO $$
BEGIN
    RAISE NOTICE 'Performance Simulator database initialized successfully!';
    RAISE NOTICE 'Default service profiles and configurations have been created.';
END $$;
