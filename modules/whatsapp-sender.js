const axios = require('axios');
require('dotenv').config();

const API_VERSION = process.env.WHATSAPP_API_VERSION || 'v17.0';
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || '';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || '';

const whatsappSender = {
  /**
   * Send text message
   */
  async sendText(to, text) {
    if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
      console.log('Message to', to, ':', text);
      return { status: 'logged' };
    }

    const url = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      to,
      text: { body: text }
    };

    try {
      const resp = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      return resp.data;
    } catch (err) {
      console.error('Error sending text message:', err.response?.data || err.message);
      throw err;
    }
  },

  /**
   * Send interactive list message
   */
  async sendInteractiveList(to, headerText, bodyText, footerText, sections) {
    if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
      console.log('Interactive list to', to, ':', bodyText);
      return { status: 'logged' };
    }

    const url = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'list',
        header: {
          type: 'text',
          text: headerText
        },
        body: {
          text: bodyText
        },
        footer: {
          text: footerText
        },
        action: {
          button: 'Select',
          sections
        }
      }
    };

    try {
      const resp = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      return resp.data;
    } catch (err) {
      console.error('Error sending interactive list:', err.response?.data || err.message);
      throw err;
    }
  },

  /**
   * Send interactive buttons message
   */
  async sendInteractiveButtons(to, headerText, bodyText, footerText, buttons) {
    if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
      console.log('Interactive buttons to', to, ':', bodyText);
      return { status: 'logged' };
    }

    const url = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        header: {
          type: 'text',
          text: headerText
        },
        body: {
          text: bodyText
        },
        footer: {
          text: footerText
        },
        action: {
          buttons
        }
      }
    };

    try {
      const resp = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      return resp.data;
    } catch (err) {
      console.error('Error sending interactive buttons:', err.response?.data || err.message);
      throw err;
    }
  },

  /**
   * Send image message
   */
  async sendImage(to, imageUrl, caption = '') {
    if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
      console.log('Image to', to, ':', imageUrl);
      return { status: 'logged' };
    }

    const url = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'image',
      image: {
        link: imageUrl
      }
    };

    if (caption) {
      payload.image.caption = caption;
    }

    try {
      const resp = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      return resp.data;
    } catch (err) {
      console.error('Error sending image:', err.response?.data || err.message);
      throw err;
    }
  },

  /**
   * Send question with options as interactive buttons
   */
  async sendQuestion(to, questionData, questionIndex) {
    const questionNum = questionIndex + 1;
    const headerText = `Question ${questionNum}`;
    const bodyText = questionData.question_text;
    const footerText = `Select your answer`;

    const buttons = [
      {
        type: 'reply',
        reply: {
          id: `ans_a_${questionIndex}`,
          title: `A: ${questionData.option_a}`
        }
      },
      {
        type: 'reply',
        reply: {
          id: `ans_b_${questionIndex}`,
          title: `B: ${questionData.option_b}`
        }
      },
      {
        type: 'reply',
        reply: {
          id: `ans_c_${questionIndex}`,
          title: `C: ${questionData.option_c}`
        }
      },
      {
        type: 'reply',
        reply: {
          id: `ans_d_${questionIndex}`,
          title: `D: ${questionData.option_d}`
        }
      }
    ];

    return this.sendInteractiveButtons(to, headerText, bodyText, footerText, buttons);
  },

  /**
   * Send practice mode menu
   */
  async sendPracticeModeMenu(to) {
    const headerText = '📚 Practice Mode';
    const bodyText = 'Select a subject to practice:';
    const footerText = 'Choose one to continue';

    const sections = [
      {
        title: 'Subjects',
        rows: [
          { id: 'practice_english', title: '📖 English' },
          { id: 'practice_math', title: '🔢 Mathematics' },
          { id: 'practice_physics', title: '⚛️ Physics' },
          { id: 'practice_chemistry', title: '🧪 Chemistry' },
          { id: 'practice_biology', title: '🔬 Biology' },
          { id: 'practice_govt', title: '🏛️ Government' }
        ]
      }
    ];

    return this.sendInteractiveList(to, headerText, bodyText, footerText, sections);
  },

  /**
   * Send onboarding subjects selection
   */
  async sendSubjectsSelection(to) {
    const headerText = '📚 Select 4 Subjects';
    const bodyText = 'You must select English + 3 other subjects. Current selection: 0/4';
    const footerText = 'Tap to select subjects';

    const sections = [
      {
        title: 'Required Subject',
        rows: [
          { id: 'subject_english', title: '✅ English (Required)' }
        ]
      },
      {
        title: 'Electives (Select 3)',
        rows: [
          { id: 'subject_math', title: '🔢 Mathematics' },
          { id: 'subject_physics', title: '⚛️ Physics' },
          { id: 'subject_chemistry', title: '🧪 Chemistry' },
          { id: 'subject_biology', title: '🔬 Biology' },
          { id: 'subject_govt', title: '🏛️ Government' }
        ]
      }
    ];

    return this.sendInteractiveList(to, headerText, bodyText, footerText, sections);
  },

  /**
   * Send session heartbeat with "Stay Active" button
   */
  async sendHeartbeatPrompt(to, sessionType = 'practice') {
    const headerText = '⏱️ Your Session is Active';
    const bodyText = sessionType === 'mock' 
      ? 'Your mock exam is still running. Tap to continue.' 
      : 'Your practice session is still active. Keep going!';
    const footerText = 'Stay active or exit';

    const buttons = [
      {
        type: 'reply',
        reply: {
          id: 'stay_active',
          title: '✅ Stay Active'
        }
      },
      {
        type: 'reply',
        reply: {
          id: 'exit_session',
          title: '❌ Exit'
        }
      }
    ];

    return this.sendInteractiveButtons(to, headerText, bodyText, footerText, buttons);
  },

  /**
   * Send premium unlock prompt with payment button
   */
  async sendPremiumPrompt(to, paymentUrl) {
    const headerText = '🔓 Unlock Premium';
    const bodyText = `Get unlimited mock exams and advanced analytics! Tap below to upgrade.`;
    const footerText = 'Limited time offer';

    const buttons = [
      {
        type: 'url',
        url: {
          display_text: '💳 Upgrade Now',
          url: paymentUrl
        }
      },
      {
        type: 'reply',
        reply: {
          id: 'later_premium',
          title: 'Ask Later'
        }
      }
    ];

    return this.sendInteractiveButtons(to, headerText, bodyText, footerText, buttons);
  },

  /**
   * Send mock exam results
   */
  async sendMockResults(to, correctAnswers, totalQuestions, scorePercentage) {
    const score = Math.round(scorePercentage);
    const gradeText = score >= 80 ? '🏆 Excellent!' : score >= 60 ? '👍 Good' : '📚 Keep Practicing';
    
    const resultText = `
${gradeText}

📊 Mock Exam Results
━━━━━━━━━━━━━━━━━━
Score: ${score}%
Correct: ${correctAnswers}/${totalQuestions}
━━━━━━━━━━━━━━━━━━

Great effort! Review where you made mistakes and practice more.
    `;

    return this.sendText(to, resultText);
  },

  /**
   * Send main menu
   */
  async sendMainMenu(to) {
    const headerText = '🎓 JAMB CBT Simulator';
    const bodyText = 'Select what you want to do:';
    const footerText = 'Choose your option';

    const sections = [
      {
        title: 'Study Options',
        rows: [
          { id: 'menu_onboarding', title: '🆕 Start Setup' },
          { id: 'menu_practice', title: '📚 Practice Mode' },
          { id: 'menu_mock', title: '⏱️ Mock Exam' },
          { id: 'menu_leaderboard', title: '🏆 Leaderboard' },
          { id: 'menu_stats', title: '📈 My Stats' },
          { id: 'menu_premium', title: '⭐ Go Premium' }
        ]
      }
    ];

    return this.sendInteractiveList(to, headerText, bodyText, footerText, sections);
  }
};

module.exports = whatsappSender;
