require("dotenv").config();

const { Pool } = require("pg");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false
});

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS posts (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    username VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    topic VARCHAR(100) NOT NULL DEFAULT 'General',
    media_urls TEXT[] NOT NULL DEFAULT '{}',
    media_types TEXT[] NOT NULL DEFAULT '{}',
    upvotes INTEGER NOT NULL DEFAULT 0,
    downvotes INTEGER NOT NULL DEFAULT 0,
    spam_reports INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comments (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    username VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    upvotes INTEGER NOT NULL DEFAULT 0,
    downvotes INTEGER NOT NULL DEFAULT 0,
    spam_reports INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS post_votes (
    post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vote_type VARCHAR(4) NOT NULL CHECK (vote_type IN ('up', 'down')),
    changed BOOLEAN NOT NULL DEFAULT false,
    PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS comment_votes (
    comment_id BIGINT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vote_type VARCHAR(4) NOT NULL CHECK (vote_type IN ('up', 'down')),
    changed BOOLEAN NOT NULL DEFAULT false,
    PRIMARY KEY (comment_id, user_id)
);

CREATE TABLE IF NOT EXISTS post_spam_reports (
    post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS comment_spam_reports (
    comment_id BIGINT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (comment_id, user_id)
);
`;

async function initDb() {
    try {
        await pool.query(SCHEMA_SQL);
        console.log("Database tables initialized successfully");
    } catch (error) {
        console.error("Database initialization error:", error);
        throw error;
    }
}

module.exports = {
    pool,
    initDb
};