-- Push Tokens Table
CREATE TABLE IF NOT EXISTS push_tokens (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR NOT NULL,
    token TEXT NOT NULL UNIQUE,
    platform VARCHAR(20) NOT NULL,
    device_id VARCHAR(255),
    user_type VARCHAR(20) NOT NULL DEFAULT 'buyer',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_used_at TIMESTAMP
);

-- Notification Logs Table
CREATE TABLE IF NOT EXISTS notification_logs (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR,
    user_type VARCHAR(20),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data TEXT,
    notification_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'sent',
    sent_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    sent_by VARCHAR,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_type ON push_tokens(user_type);
CREATE INDEX IF NOT EXISTS idx_push_tokens_is_active ON push_tokens(is_active);
CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id ON notification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_sent_at ON notification_logs(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_logs_notification_type ON notification_logs(notification_type);
