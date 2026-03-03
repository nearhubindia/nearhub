-- In-App Notifications Table
-- Persistent notification feed visible within the app
CREATE TABLE IF NOT EXISTS in_app_notifications (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR,
    user_type VARCHAR(20),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'info',
    action_label VARCHAR(50),
    action_url VARCHAR(255),
    category VARCHAR(50),
    reference_id VARCHAR,
    is_read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMP,
    priority VARCHAR(20) DEFAULT 'normal',
    expires_at TIMESTAMP,
    created_by VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_in_app_notifications_user_id ON in_app_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_in_app_notifications_user_type ON in_app_notifications(user_type);
CREATE INDEX IF NOT EXISTS idx_in_app_notifications_created_at ON in_app_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_in_app_notifications_is_read ON in_app_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_in_app_notifications_category ON in_app_notifications(category);
CREATE INDEX IF NOT EXISTS idx_in_app_notifications_expires_at ON in_app_notifications(expires_at);
