-- ============================================================
-- Vero AI Platform — Performance Indexes
-- Migration 002: Add query performance indexes
-- ============================================================

CREATE INDEX idx_cache_agent_created ON response_cache (agent_id, created_at);
CREATE INDEX idx_messages_conv_created ON messages (conversation_id, created_at);
CREATE INDEX idx_conv_agent ON conversations (agent_id);
CREATE INDEX idx_tokenlog_admin_created ON token_logs (admin_id, created_at);
CREATE INDEX idx_unanswered_admin ON unanswered_queries (admin_id, status);
CREATE INDEX idx_complaints_admin_created ON complaints (admin_id, created_at);
