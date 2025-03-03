-- Drop triggers first
DROP TRIGGER IF EXISTS update_messages_updated_at ON messages;
DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
DROP TRIGGER IF EXISTS update_sellers_updated_at ON sellers;
DROP TRIGGER IF EXISTS update_conversation_timestamp ON messages;

-- Drop functions
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP FUNCTION IF EXISTS update_conversation_last_message();

-- Drop tables in correct order (respect foreign key constraints)
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS conversations;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS seller_connection_tokens;
DROP TABLE IF EXISTS sellers;

-- Drop types
DROP TYPE IF EXISTS message_status;
DROP TYPE IF EXISTS business_type;
DROP TYPE IF EXISTS user_role;
