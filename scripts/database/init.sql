-- Origo Stack Database Initialization Script
-- This script creates the initial database schema for local development

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create schemas for different services
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS rooms;
CREATE SCHEMA IF NOT EXISTS chat;
CREATE SCHEMA IF NOT EXISTS billing;
CREATE SCHEMA IF NOT EXISTS recording;

-- Auth Service Tables
CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    avatar_url TEXT,
    email_verified BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS auth.roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auth.user_roles (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES auth.roles(id) ON DELETE CASCADE,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    granted_by UUID REFERENCES auth.users(id),
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP WITH TIME ZONE
);

-- Rooms Service Tables
CREATE TABLE IF NOT EXISTS rooms.rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    room_type VARCHAR(20) DEFAULT 'meeting', -- meeting, webinar, conference
    max_participants INTEGER DEFAULT 100,
    password VARCHAR(255),
    is_recording_enabled BOOLEAN DEFAULT TRUE,
    is_chat_enabled BOOLEAN DEFAULT TRUE,
    waiting_room_enabled BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'scheduled', -- scheduled, active, ended
    scheduled_start TIMESTAMP WITH TIME ZONE,
    scheduled_end TIMESTAMP WITH TIME ZONE,
    actual_start TIMESTAMP WITH TIME ZONE,
    actual_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rooms.participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID REFERENCES rooms.rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name VARCHAR(100),
    role VARCHAR(20) DEFAULT 'participant', -- host, moderator, participant
    joined_at TIMESTAMP WITH TIME ZONE,
    left_at TIMESTAMP WITH TIME ZONE,
    connection_quality JSONB,
    is_audio_enabled BOOLEAN DEFAULT TRUE,
    is_video_enabled BOOLEAN DEFAULT TRUE,
    is_screen_sharing BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Chat Service Tables
CREATE TABLE IF NOT EXISTS chat.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID REFERENCES rooms.rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text', -- text, file, emoji, system
    reply_to UUID REFERENCES chat.messages(id),
    is_edited BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat.message_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID REFERENCES chat.messages(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    emoji VARCHAR(10) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(message_id, user_id, emoji)
);

-- Recording Service Tables
CREATE TABLE IF NOT EXISTS recording.recordings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID REFERENCES rooms.rooms(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT,
    duration_seconds INTEGER,
    format VARCHAR(10) DEFAULT 'mp4',
    resolution VARCHAR(20),
    status VARCHAR(20) DEFAULT 'processing', -- processing, completed, failed
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    download_url TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Billing Service Tables
CREATE TABLE IF NOT EXISTS billing.plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    price_monthly DECIMAL(10,2),
    price_yearly DECIMAL(10,2),
    max_participants INTEGER,
    max_meeting_duration INTEGER, -- in minutes
    storage_gb INTEGER,
    features JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS billing.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES billing.plans(id),
    status VARCHAR(20) DEFAULT 'active', -- active, cancelled, expired, suspended
    billing_cycle VARCHAR(10) DEFAULT 'monthly', -- monthly, yearly
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS billing.usage_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    room_id UUID REFERENCES rooms.rooms(id) ON DELETE CASCADE,
    metric_type VARCHAR(50) NOT NULL, -- meeting_minutes, storage_used, participants
    metric_value DECIMAL(10,2) NOT NULL,
    measured_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    billing_period DATE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON auth.users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON auth.users(username);
CREATE INDEX IF NOT EXISTS idx_users_status ON auth.users(status);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON auth.refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON auth.refresh_tokens(expires_at);

CREATE INDEX IF NOT EXISTS idx_rooms_owner_id ON rooms.rooms(owner_id);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms.rooms(status);
CREATE INDEX IF NOT EXISTS idx_rooms_scheduled_start ON rooms.rooms(scheduled_start);

CREATE INDEX IF NOT EXISTS idx_participants_room_id ON rooms.participants(room_id);
CREATE INDEX IF NOT EXISTS idx_participants_user_id ON rooms.participants(user_id);

CREATE INDEX IF NOT EXISTS idx_messages_room_id ON chat.messages(room_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON chat.messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON chat.messages(created_at);

CREATE INDEX IF NOT EXISTS idx_recordings_room_id ON recording.recordings(room_id);
CREATE INDEX IF NOT EXISTS idx_recordings_status ON recording.recordings(status);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON billing.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON billing.subscriptions(status);

CREATE INDEX IF NOT EXISTS idx_usage_metrics_user_id ON billing.usage_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_metrics_billing_period ON billing.usage_metrics(billing_period);

-- Insert default roles
INSERT INTO auth.roles (name, description, permissions) VALUES
    ('admin', 'System administrator with full access', '["*"]'),
    ('moderator', 'Room moderator with management permissions', '["room:manage", "user:moderate", "recording:manage"]'),
    ('user', 'Regular user with basic permissions', '["room:join", "chat:send", "media:share"]')
ON CONFLICT (name) DO NOTHING;

-- Insert default plans
INSERT INTO billing.plans (name, description, price_monthly, price_yearly, max_participants, max_meeting_duration, storage_gb, features) VALUES
    ('Free', 'Basic plan for personal use', 0.00, 0.00, 3, 40, 1, '["basic_meeting", "chat"]'),
    ('Pro', 'Professional plan for small teams', 14.99, 149.90, 100, 0, 10, '["unlimited_meetings", "recording", "chat", "screen_sharing"]'),
    ('Business', 'Advanced plan for organizations', 19.99, 199.90, 300, 0, 100, '["unlimited_meetings", "recording", "chat", "screen_sharing", "admin_dashboard", "analytics"]'),
    ('Enterprise', 'Custom plan for large enterprises', 49.99, 499.90, 1000, 0, 1000, '["unlimited_meetings", "recording", "chat", "screen_sharing", "admin_dashboard", "analytics", "sso", "api_access"]')
ON CONFLICT (name) DO NOTHING;

-- Create a test user (password: 'password123')
INSERT INTO auth.users (email, username, password_hash, first_name, last_name, email_verified) VALUES
    ('admin@origo.local', 'admin', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/N9M.zGV/2', 'Admin', 'User', TRUE),
    ('user@origo.local', 'testuser', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/N9M.zGV/2', 'Test', 'User', TRUE)
ON CONFLICT (email) DO NOTHING;

-- Assign roles to test users
INSERT INTO auth.user_roles (user_id, role_id)
SELECT u.id, r.id 
FROM auth.users u, auth.roles r 
WHERE u.username = 'admin' AND r.name = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO auth.user_roles (user_id, role_id)
SELECT u.id, r.id 
FROM auth.users u, auth.roles r 
WHERE u.username = 'testuser' AND r.name = 'user'
ON CONFLICT DO NOTHING;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS update_users_updated_at ON auth.users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_rooms_updated_at ON rooms.rooms;
CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON rooms.rooms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_messages_updated_at ON chat.messages;
CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON chat.messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON billing.subscriptions;
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON billing.subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions to database user
GRANT USAGE ON SCHEMA auth, rooms, chat, billing, recording TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA auth, rooms, chat, billing, recording TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA auth, rooms, chat, billing, recording TO postgres;
