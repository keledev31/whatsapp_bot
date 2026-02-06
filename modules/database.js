const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'jamb_bot',
  user: process.env.POSTGRES_USER || 'jamb_user',
  password: process.env.POSTGRES_PASSWORD || 'jamb_password',
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  max: 10
});

pool.on('connect', () => console.log('✓ PostgreSQL connected'));
pool.on('error', (err) => console.error('PostgreSQL error:', err));

const db = {
  /**
   * Get or create user
   */
  async getOrCreateUser(phoneNumber, fullName = null) {
    try {
      let result = await pool.query('SELECT * FROM users WHERE phone_number = $1', [phoneNumber]);
      
      if (result.rows.length === 0) {
        result = await pool.query(
          'INSERT INTO users (phone_number, full_name) VALUES ($1, $2) RETURNING *',
          [phoneNumber, fullName]
        );
      }
      
      return result.rows[0];
    } catch (err) {
      console.error('Error getting/creating user:', err);
      throw err;
    }
  },

  /**
   * Update user subjects
   */
  async updateUserSubjects(userId, subjects) {
    try {
      const result = await pool.query(
        'UPDATE users SET subjects = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
        [subjects, userId]
      );
      return result.rows[0];
    } catch (err) {
      console.error('Error updating user subjects:', err);
      throw err;
    }
  },

  /**
   * Get user by phone number
   */
  async getUserByPhone(phoneNumber) {
    try {
      const result = await pool.query('SELECT * FROM users WHERE phone_number = $1', [phoneNumber]);
      return result.rows[0] || null;
    } catch (err) {
      console.error('Error getting user:', err);
      throw err;
    }
  },

  /**
   * Get random questions
   */
  async getRandomQuestions(count = 10, subject = null) {
    try {
      let query = 'SELECT * FROM questions';
      const params = [];
      
      if (subject) {
        query += ' WHERE subject = $1';
        params.push(subject);
      }
      
      query += ` ORDER BY RANDOM() LIMIT $${params.length + 1}`;
      params.push(count);
      
      const result = await pool.query(query, params);
      return result.rows;
    } catch (err) {
      console.error('Error fetching random questions:', err);
      throw err;
    }
  },

  /**
   * Get mock exam questions (180 questions across all subjects)
   */
  async getMockExamQuestions() {
    try {
      // Get 36 questions per subject (6 subjects = 180 total)
      const result = await pool.query(`
        SELECT subject, id, question_number, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation, image_url
        FROM (
          SELECT subject, ROW_NUMBER() OVER (PARTITION BY subject ORDER BY RANDOM()) as rn, *
          FROM questions
        ) t
        WHERE rn <= 36
        ORDER BY subject, question_number
      `);
      return result.rows;
    } catch (err) {
      console.error('Error fetching mock exam questions:', err);
      throw err;
    }
  },

  /**
   * Get leaderboard (top 10)
   */
  async getLeaderboard(limit = 10) {
    try {
      const result = await pool.query(`
        SELECT * FROM leaderboard LIMIT $1
      `, [limit]);
      return result.rows;
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
      throw err;
    }
  },

  /**
   * Get user leaderboard position
   */
  async getUserRank(userId) {
    try {
      const result = await pool.query(`
        SELECT * FROM leaderboard WHERE id = $1
      `, [userId]);
      return result.rows[0] || null;
    } catch (err) {
      console.error('Error fetching user rank:', err);
      throw err;
    }
  },

  /**
   * Save practice session log
   */
  async savePracticeLog(userId, subject, correctAnswers, questionCount = 10) {
    try {
      const result = await pool.query(
        `INSERT INTO practice_logs (user_id, subject, questions_count, correct_answers, completed_at, status)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, 'completed')
         RETURNING *`,
        [userId, subject, questionCount, correctAnswers]
      );
      
      // Update user score
      const scorePercentage = Math.round((correctAnswers / questionCount) * 100);
      await pool.query(`
        INSERT INTO user_scores (user_id, subject, score, attempts, best_score)
        VALUES ($1, $2, $3, 1, $3)
        ON CONFLICT (user_id, subject) DO UPDATE SET
        score = EXCLUDED.score,
        attempts = user_scores.attempts + 1,
        best_score = GREATEST(user_scores.best_score, EXCLUDED.best_score),
        updated_at = CURRENT_TIMESTAMP
      `, [userId, subject, scorePercentage]);
      
      return result.rows[0];
    } catch (err) {
      console.error('Error saving practice log:', err);
      throw err;
    }
  },

  /**
   * Save mock exam log
   */
  async saveMockExamLog(userId, correctAnswers, totalQuestions = 180) {
    try {
      const finalScore = Math.round((correctAnswers / totalQuestions) * 100);
      const result = await pool.query(
        `INSERT INTO mock_exam_logs (user_id, total_questions, correct_answers, final_score, completed_at, status)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, 'completed')
         RETURNING *`,
        [userId, totalQuestions, correctAnswers, finalScore]
      );
      
      return result.rows[0];
    } catch (err) {
      console.error('Error saving mock exam log:', err);
      throw err;
    }
  },

  /**
   * Get question by ID
   */
  async getQuestionById(questionId) {
    try {
      const result = await pool.query('SELECT * FROM questions WHERE id = $1', [questionId]);
      return result.rows[0] || null;
    } catch (err) {
      console.error('Error fetching question:', err);
      throw err;
    }
  },

  /**
   * Get novel-related questions (The Lekki Headmaster)
   */
  async getNovelQuestions(novelName = 'The Lekki Headmaster') {
    try {
      const result = await pool.query(
        'SELECT * FROM questions WHERE is_novel = true AND novel_name = $1',
        [novelName]
      );
      return result.rows;
    } catch (err) {
      console.error('Error fetching novel questions:', err);
      throw err;
    }
  },

  /**
   * Create Paystack transaction record
   */
  async createTransaction(userId, paystackRef, amountNaira, plan) {
    try {
      const result = await pool.query(
        `INSERT INTO transactions (user_id, paystack_reference, amount_naira, plan, status)
         VALUES ($1, $2, $3, $4, 'pending')
         RETURNING *`,
        [userId, paystackRef, amountNaira, plan]
      );
      return result.rows[0];
    } catch (err) {
      console.error('Error creating transaction:', err);
      throw err;
    }
  },

  /**
   * Update transaction status
   */
  async updateTransactionStatus(paystackRef, status, userId) {
    try {
      const result = await pool.query(
        `UPDATE transactions SET status = $1, paid_at = CURRENT_TIMESTAMP WHERE paystack_reference = $2
         RETURNING *`,
        [status, paystackRef]
      );
      
      if (status === 'success' && result.rows.length > 0) {
        const transaction = result.rows[0];
        // Update user premium access
        const expiryDate = new Date();
        if (transaction.plan === '1_month') expiryDate.setMonth(expiryDate.getMonth() + 1);
        else if (transaction.plan === '3_months') expiryDate.setMonth(expiryDate.getMonth() + 3);
        else if (transaction.plan === 'lifetime') expiryDate.setFullYear(expiryDate.getFullYear() + 10);
        
        await pool.query(
          'UPDATE users SET premium_access = true, premium_expires_at = $1 WHERE id = $2',
          [expiryDate, userId]
        );
      }
      
      return result.rows[0];
    } catch (err) {
      console.error('Error updating transaction:', err);
      throw err;
    }
  },

  /**
   * Log session heartbeat
   */
  async logHeartbeat(userId, sessionType = 'practice') {
    try {
      await pool.query(
        'INSERT INTO session_heartbeats (user_id, session_type) VALUES ($1, $2)',
        [userId, sessionType]
      );
    } catch (err) {
      console.error('Error logging heartbeat:', err);
    }
  },

  /**
   * Get user stats
   */
  async getUserStats(userId) {
    try {
      const result = await pool.query(`
        SELECT 
          u.id,
          u.phone_number,
          u.full_name,
          array_agg(DISTINCT us.subject) as subjects,
          COUNT(DISTINCT pl.id) as total_practice_sessions,
          COUNT(DISTINCT mel.id) as total_mock_exams,
          COALESCE(AVG(CAST(pl.correct_answers AS float) / NULLIF(pl.questions_count, 0)), 0) as avg_practice_score,
          COALESCE(MAX(mel.final_score), 0) as best_mock_score
        FROM users u
        LEFT JOIN user_scores us ON u.id = us.user_id
        LEFT JOIN practice_logs pl ON u.id = pl.user_id
        LEFT JOIN mock_exam_logs mel ON u.id = mel.user_id
        WHERE u.id = $1
        GROUP BY u.id, u.phone_number, u.full_name
      `, [userId]);
      
      return result.rows[0] || null;
    } catch (err) {
      console.error('Error fetching user stats:', err);
      throw err;

    /**
     * Check if user has active subscription
     */
    async hasActiveSubscription(phoneNumber) {
      try {
        const result = await pool.query(
          `SELECT subscription_status, expiry_date FROM users 
           WHERE phone_number = $1 AND subscription_status = 'active' 
           AND (expiry_date IS NULL OR expiry_date > CURRENT_TIMESTAMP)`,
          [phoneNumber]
        );
        return result.rows.length > 0;
      } catch (err) {
        console.error('Error checking subscription status:', err);
        throw err;
      }
    },
  /**
    /**
     * Get user subscription status
     */
    async getUserSubscription(phoneNumber) {
      try {
        const result = await pool.query(
          `SELECT id, email, subscription_status, subscription_code, subscription_plan, expiry_date 
           FROM users WHERE phone_number = $1`,
          [phoneNumber]
        );
        return result.rows[0] || null;
      } catch (err) {
        console.error('Error fetching user subscription:', err);
        throw err;
      }
    },
   * Initialize database (create tables if not exist)
    /**
     * Update subscription status (on successful payment)
     */
    async updateSubscription(phoneNumber, email, subscriptionCode, authorizationCode, subscriptionPlan, metadata = null) {
      try {
        const expiryDate = new Date();
        if (subscriptionPlan === '1_month') {
          expiryDate.setMonth(expiryDate.getMonth() + 1);
        } else if (subscriptionPlan === '3_months') {
          expiryDate.setMonth(expiryDate.getMonth() + 3);
        } else if (subscriptionPlan === 'lifetime') {
          expiryDate.setFullYear(expiryDate.getFullYear() + 100);
        }
   */
        const result = await pool.query(
          `UPDATE users SET 
           email = COALESCE($2, email),
           subscription_status = 'active',
           subscription_code = $3,
           authorization_code = $4,
           subscription_plan = $5,
           expiry_date = $6,
           subscription_metadata = COALESCE($7, '{}'),
           updated_at = CURRENT_TIMESTAMP
           WHERE phone_number = $1 
           RETURNING *`,
          [phoneNumber, email, subscriptionCode, authorizationCode, subscriptionPlan, expiryDate, JSON.stringify(metadata || {})]
        );
      
        if (result.rows.length === 0) {
          throw new Error('User not found');
        }
  async initialize() {
        return result.rows[0];
      } catch (err) {
        console.error('Error updating subscription:', err);
        throw err;
      }
    },
    try {
    /**
     * Deactivate subscription (on cancel or failure)
     */
    async deactivateSubscription(phoneNumber, reason = null) {
      try {
        const metadata = reason ? { deactivated_reason: reason, deactivated_at: new Date().toISOString() } : {};
      
        const result = await pool.query(
          `UPDATE users SET 
           subscription_status = 'inactive',
           subscription_metadata = $2,
           updated_at = CURRENT_TIMESTAMP
           WHERE phone_number = $1 
           RETURNING *`,
          [phoneNumber, JSON.stringify(metadata)]
        );
      
        return result.rows[0] || null;
      } catch (err) {
        console.error('Error deactivating subscription:', err);
        throw err;
      }
    },
      const sqlPath = require('path').join(__dirname, '../db/init.sql');
    /**
     * Store Paystack transaction reference
     */
    async storePaystackReference(phoneNumber, paystackReference, plan) {
      try {
        const result = await pool.query(
          `UPDATE users SET 
           paystack_reference = $2,
           subscription_plan = $3,
           updated_at = CURRENT_TIMESTAMP
           WHERE phone_number = $1 
           RETURNING *`,
          [phoneNumber, paystackReference, plan]
        );
      
        return result.rows[0] || null;
      } catch (err) {
        console.error('Error storing Paystack reference:', err);
        throw err;
      }
    },
      const fs = require('fs');
    /**
     * Initialize database (create tables if not exist)
     */
      const sql = fs.readFileSync(sqlPath, 'utf-8');
      
      // Split by semicolon and execute each statement
      const statements = sql.split(';').filter(s => s.trim());
      for (const statement of statements) {
        if (statement.trim()) {
          await pool.query(statement);
        }
      }
      
      console.log('✓ Database initialized successfully');
    } catch (err) {
      console.error('Error initializing database:', err);
      throw err;
    }
  },

  /**
   * Close database connection
   */
  async close() {
    await pool.end();
  },

  /**
   * Get pool for advanced queries
   */
  getPool() {
    return pool;
  }
};

module.exports = db;
