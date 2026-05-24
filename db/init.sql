-- MySQL Database Schema Initialization
-- Automatically loaded on first Docker container startup

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),

    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE,

    password_hash TEXT,

    first_name VARCHAR(100),
    last_name VARCHAR(100),

    university VARCHAR(255),
    field_of_study VARCHAR(255),
    graduation_year INT,

    avatar_url TEXT,

    achievement_goal ENUM('GET_FIRST_JOB', 'SWITCH_DEVELOPER_ROLE', 'IMPROVE_CODING_SKILLS', 'PREPARE_INTERVIEWS', 'BUILD_PORTFOLIO', 'UNDERSTAND_MARKET'),
    target_role VARCHAR(255),
    cv_url VARCHAR(255),
    transcript_url VARCHAR(255),

    onboarding_completed BOOLEAN DEFAULT FALSE,

    is_email_verified BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auth_providers (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),

    user_id VARCHAR(36) NOT NULL,

    provider VARCHAR(50) NOT NULL,
    provider_user_id VARCHAR(255),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY unique_provider (provider, provider_user_id),
    CONSTRAINT fk_auth_providers_users 
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE
);
