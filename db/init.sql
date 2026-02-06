-- PostgreSQL Schema for JAMB CBT Bot

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  email VARCHAR(255) UNIQUE,
  subjects TEXT[] DEFAULT '{}',  -- Array of selected subjects
  total_score INT DEFAULT 0,
  premium_access BOOLEAN DEFAULT FALSE,
  premium_expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  subscription_status VARCHAR(20) DEFAULT 'inactive',  -- active, inactive, expired, cancelled
  subscription_code VARCHAR(255),  -- Paystack subscription code
  authorization_code VARCHAR(255),  -- Paystack authorization code (hashed)
  paystack_reference VARCHAR(255),  -- Latest Paystack transaction reference
  expiry_date TIMESTAMP,  -- Subscription expiry
  subscription_plan VARCHAR(50),  -- 1_month, 3_months, lifetime, recurring
  subscription_metadata JSONB DEFAULT '{}'  -- Store additional Paystack metadata
);

-- Subject-wise scores
CREATE TABLE IF NOT EXISTS user_scores (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject VARCHAR(50) NOT NULL,
  score INT DEFAULT 0,
  attempts INT DEFAULT 0,
  best_score INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, subject)
);

-- Questions table (JAMB questions)
CREATE TABLE IF NOT EXISTS questions (
  id SERIAL PRIMARY KEY,
  subject VARCHAR(50) NOT NULL,
  year INT NOT NULL,
  question_number INT NOT NULL,
  question_text TEXT NOT NULL,
  option_a TEXT,
  option_b TEXT,
  option_c TEXT,
  option_d TEXT,
  correct_answer CHAR(1),
  explanation TEXT,
  image_url VARCHAR(500),
  category VARCHAR(100),
  is_novel BOOLEAN DEFAULT FALSE,
  novel_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(subject, year, question_number)
);

-- Practice session logs
CREATE TABLE IF NOT EXISTS practice_logs (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject VARCHAR(50) NOT NULL,
  questions_count INT DEFAULT 10,
  correct_answers INT DEFAULT 0,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  status VARCHAR(20) DEFAULT 'in_progress'  -- in_progress, completed, abandoned
);

-- Mock exam logs
CREATE TABLE IF NOT EXISTS mock_exam_logs (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total_questions INT DEFAULT 180,
  total_duration_minutes INT DEFAULT 120,
  correct_answers INT DEFAULT NULL,
  final_score INT DEFAULT NULL,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  status VARCHAR(20) DEFAULT 'in_progress'  -- in_progress, completed, abandoned, timed_out
);

-- Mock exam answers
CREATE TABLE IF NOT EXISTS mock_exam_answers (
  id SERIAL PRIMARY KEY,
  mock_exam_id INT NOT NULL REFERENCES mock_exam_logs(id) ON DELETE CASCADE,
  question_id INT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  user_answer CHAR(1),
  is_correct BOOLEAN,
  time_spent_seconds INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Leaderboard view (materialized for performance)
CREATE OR REPLACE VIEW leaderboard AS
SELECT 
  u.id,
  u.phone_number,
  u.full_name,
  COALESCE(SUM(us.best_score), 0) as total_score,
  COUNT(DISTINCT us.subject) as subjects_completed,
  u.created_at,
  RANK() OVER (ORDER BY COALESCE(SUM(us.best_score), 0) DESC) as rank
FROM users u
LEFT JOIN user_scores us ON u.id = us.user_id
GROUP BY u.id, u.phone_number, u.full_name, u.created_at
ORDER BY total_score DESC;

-- Paystack transactions log
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  paystack_reference VARCHAR(255) UNIQUE NOT NULL,
  amount_naira INT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',  -- pending, success, failed
  plan VARCHAR(50),  -- 1_month, 3_months, lifetime
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  paid_at TIMESTAMP
);

-- Session heartbeat logs
CREATE TABLE IF NOT EXISTS session_heartbeats (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_type VARCHAR(50),  -- practice, mock
  heartbeat_sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  user_active BOOLEAN DEFAULT FALSE
);

-- Indexes for performance
CREATE INDEX idx_users_phone ON users(phone_number);
CREATE INDEX idx_questions_subject_year ON questions(subject, year);
CREATE INDEX idx_practice_logs_user ON practice_logs(user_id);
CREATE INDEX idx_mock_exam_logs_user ON mock_exam_logs(user_id);
CREATE INDEX idx_user_scores_user ON user_scores(user_id);
