CREATE TABLE IF NOT EXISTS sparks (
    user_id TEXT PRIMARY KEY,
    crystals INTEGER DEFAULT 0,
    tickets INTEGER DEFAULT 0,
    ten_tickets INTEGER DEFAULT 0,
    target TEXT,
    last_updated TIMESTAMP DEFAULT current_timestamp
)