CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS sparks (
    user_id TEXT PRIMARY KEY,
    guild_ids TEXT[],
    username TEXT,
    crystals INTEGER DEFAULT 0,
    tickets INTEGER DEFAULT 0,
    ten_tickets INTEGER DEFAULT 0,
    target_id uuid,
    target_memo TEXT,
    last_updated TIMESTAMP DEFAULT current_timestamp
);

CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON sparks
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

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

CREATE TABLE IF NOT EXISTS profiles (
    user_id TEXT PRIMARY KEY,
    guild_ids TEXT[],
    crew_id INTEGER,
    nickname TEXT,
    pronouns TEXT,
    granblue_id INTEGER,
    granblue_name TEXT,
    gog TEXT,
    psn TEXT,
    steam TEXT,
    switch TEXT,
    xbox TEXT
);

CREATE TABLE rateups (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    gacha_id uuid,
    user_id text,
    rate numeric
);