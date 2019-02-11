CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS sparks (
    user_id TEXT PRIMARY KEY,
    crystals INTEGER DEFAULT 0,
    tickets INTEGER DEFAULT 0,
    ten_tickets INTEGER DEFAULT 0,
    target TEXT,
    last_updated TIMESTAMP DEFAULT current_timestamp
);

CREATE TABLE IF NOT EXISTS gacha (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT,
    rarity INTEGER,
    item_type INTEGER,
    recruits TEXT,
    premium INTEGER,
    flash INTEGER,
    legend INTEGER,
    valentine INTEGER,
    summer INTEGER,
    halloween INTEGER,
    holiday INTEGER
);