const Redis = require('ioredis');

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
});

redis.on('connect', () => console.log('✓ Redis connected'));
redis.on('error', (err) => console.error('Redis error:', err));

const SESSION_TTL = 24 * 60 * 60; // 24 hours
const PRACTICE_TTL = 60 * 60; // 1 hour
const MOCK_EXAM_TTL = 2 * 60 * 60; // 2 hours

const redisSession = {
  /**
   * Get user session
   */
  async getSession(phoneNumber) {
    const sessionKey = `session:${phoneNumber}`;
    const data = await redis.get(sessionKey);
    return data ? JSON.parse(data) : null;
  },

  /**
   * Create or update user session
   */
  async setSession(phoneNumber, sessionData) {
    const sessionKey = `session:${phoneNumber}`;
    await redis.setex(sessionKey, SESSION_TTL, JSON.stringify(sessionData));
  },

  /**
   * Start onboarding
   */
  async startOnboarding(phoneNumber) {
    const session = {
      phone_number: phoneNumber,
      mode: 'onboarding',
      step: 'welcome',
      selected_subjects: [],
      created_at: new Date().toISOString(),
      last_activity: new Date().toISOString()
    };
    await this.setSession(phoneNumber, session);
    return session;
  },

  /**
   * Update onboarding progress
   */
  async updateOnboardingSubjects(phoneNumber, subjects) {
    const session = await this.getSession(phoneNumber);
    if (session) {
      session.selected_subjects = subjects;
      session.last_activity = new Date().toISOString();
      if (subjects.length === 4) {
        session.step = 'completed';
      }
      await this.setSession(phoneNumber, session);
    }
    return session;
  },

  /**
   * Start practice mode
   */
  async startPractice(phoneNumber, subject, questions) {
    const session = {
      phone_number: phoneNumber,
      mode: 'practice',
      subject,
      questions,
      current_question_index: 0,
      answers: {},
      started_at: new Date().toISOString(),
      last_activity: new Date().toISOString()
    };
    const practiceKey = `practice:${phoneNumber}`;
    await redis.setex(practiceKey, PRACTICE_TTL, JSON.stringify(session));
    return session;
  },

  /**
   * Get current practice session
   */
  async getPractice(phoneNumber) {
    const practiceKey = `practice:${phoneNumber}`;
    const data = await redis.get(practiceKey);
    return data ? JSON.parse(data) : null;
  },

  /**
   * Submit practice answer
   */
  async submitPracticeAnswer(phoneNumber, questionIndex, answer) {
    const practiceKey = `practice:${phoneNumber}`;
    const session = await this.getPractice(phoneNumber);
    if (session) {
      session.answers[questionIndex] = answer;
      session.current_question_index = questionIndex + 1;
      session.last_activity = new Date().toISOString();
      await redis.setex(practiceKey, PRACTICE_TTL, JSON.stringify(session));
    }
    return session;
  },

  /**
   * Complete practice
   */
  async completePractice(phoneNumber) {
    const practiceKey = `practice:${phoneNumber}`;
    const session = await this.getPractice(phoneNumber);
    if (session) {
      session.completed_at = new Date().toISOString();
      session.status = 'completed';
    }
    await redis.del(practiceKey);
    return session;
  },

  /**
   * Start mock exam
   */
  async startMockExam(phoneNumber, questions) {
    const session = {
      phone_number: phoneNumber,
      mode: 'mock',
      questions,
      current_question_index: 0,
      answers: {},
      duration_minutes: 120,
      timer_end_at: new Date(Date.now() + 120 * 60 * 1000).toISOString(),
      started_at: new Date().toISOString(),
      last_activity: new Date().toISOString(),
      status: 'in_progress'
    };
    const mockKey = `mock:${phoneNumber}`;
    await redis.setex(mockKey, MOCK_EXAM_TTL, JSON.stringify(session));
    return session;
  },

  /**
   * Get current mock exam session
   */
  async getMockExam(phoneNumber) {
    const mockKey = `mock:${phoneNumber}`;
    const data = await redis.get(mockKey);
    return data ? JSON.parse(data) : null;
  },

  /**
   * Submit mock exam answer
   */
  async submitMockAnswer(phoneNumber, questionIndex, answer) {
    const mockKey = `mock:${phoneNumber}`;
    const session = await this.getMockExam(phoneNumber);
    if (session) {
      session.answers[questionIndex] = answer;
      session.current_question_index = questionIndex + 1;
      session.last_activity = new Date().toISOString();
      
      // Check if time is up
      if (new Date(session.timer_end_at) <= new Date()) {
        session.status = 'timed_out';
      }
      
      await redis.setex(mockKey, MOCK_EXAM_TTL, JSON.stringify(session));
    }
    return session;
  },

  /**
   * Complete mock exam
   */
  async completeMockExam(phoneNumber) {
    const mockKey = `mock:${phoneNumber}`;
    const session = await this.getMockExam(phoneNumber);
    if (session) {
      session.completed_at = new Date().toISOString();
      session.status = 'completed';
    }
    await redis.del(mockKey);
    return session;
  },

  /**
   * Handle resume (Resume text)
   */
  async handleResume(phoneNumber) {
    const mockSession = await this.getMockExam(phoneNumber);
    const practiceSession = await this.getPractice(phoneNumber);

    if (mockSession && mockSession.status === 'in_progress') {
      // Check if time is still valid
      if (new Date(mockSession.timer_end_at) > new Date()) {
        mockSession.last_activity = new Date().toISOString();
        const mockKey = `mock:${phoneNumber}`;
        await redis.setex(mockKey, MOCK_EXAM_TTL, JSON.stringify(mockSession));
        return { type: 'mock', session: mockSession };
      } else {
        return { type: 'mock', session: mockSession, timed_out: true };
      }
    }

    if (practiceSession && practiceSession.status !== 'completed') {
      practiceSession.last_activity = new Date().toISOString();
      const practiceKey = `practice:${phoneNumber}`;
      await redis.setex(practiceKey, PRACTICE_TTL, JSON.stringify(practiceSession));
      return { type: 'practice', session: practiceSession };
    }

    return null;
  },

  /**
   * Session heartbeat - extend session timeout
   */
  async extendSession(phoneNumber) {
    const session = await this.getSession(phoneNumber);
    if (session) {
      session.last_activity = new Date().toISOString();
      await this.setSession(phoneNumber, session);
      return true;
    }
    return false;
  },

  /**
   * Clear session
   */
  async clearSession(phoneNumber) {
    const sessionKey = `session:${phoneNumber}`;
    const practiceKey = `practice:${phoneNumber}`;
    const mockKey = `mock:${phoneNumber}`;
    
    await Promise.all([
      redis.del(sessionKey),
      redis.del(practiceKey),
      redis.del(mockKey)
    ]);
  },

  /**
   * Get all active sessions (for admin)
   */
  async getAllActiveSessions() {
    const keys = await redis.keys('session:*');
    const sessions = [];
    for (const key of keys) {
      const data = await redis.get(key);
      if (data) sessions.push(JSON.parse(data));
    }
    return sessions;
  },

  /**
   * Close Redis connection
   */
  async close() {
    await redis.quit();
  }
};

module.exports = redisSession;
