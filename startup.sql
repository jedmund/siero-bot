CREATE TABLE users (
    id VARCHAR(32) NOT NULL,
    server_id VARCHAR(32),
    crystals int DEFAULT 0,
    tickets int DEFAULT 0,
    tentickets int DEFAULT 0,
    PRIMARY KEY(id, server_id)
)
