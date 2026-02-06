const express = require('express');
const axios = require('axios');
require('dotenv').config();
const questions = require('./data/questions.json');

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'change_me';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || '';
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const API_VERSION = process.env.WHATSAPP_API_VERSION || 'v17.0';

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('WEBHOOK_VERIFIED');
      return res.status(200).send(challenge);
    } else {
      return res.sendStatus(403);
    }
  }
  res.sendStatus(400);
});

app.post('/webhook', async (req, res) => {
  try {
    const body = req.body;
    if (!body || !body.entry) return res.sendStatus(400);

    for (const entry of body.entry) {
      const changes = entry.changes || [];
      for (const change of changes) {
        const value = change.value || {};
        const messages = value.messages || [];
        for (const message of messages) {
          const from = message.from;
          const text = message.text && message.text.body ? message.text.body.trim() : '';
          if (!text) continue;

          const match = text.match(/([a-zA-Z]+)\s+(\d{4})\s+q(\d+)/i);
          let reply = '';
          if (match) {
            const subject = match[1].toLowerCase();
            const year = match[2];
            const qnum = String(parseInt(match[3], 10));

            const found = (questions[subject] && questions[subject][year] && questions[subject][year][qnum]) || null;
            if (found) {
              reply = `Q${qnum} (${subject} ${year}): ${found.question}\n\nAnswer: ${found.answer}`;
            } else {
              reply = `Sorry, I couldn't find ${subject} ${year} q${qnum} in the database.`;
            }
          } else {
            reply = "Please send queries in the format: 'english 2023 q15'";
          }

          // send reply
          if (WHATSAPP_TOKEN && PHONE_NUMBER_ID) {
            await sendMessage(from, reply);
          } else {
            console.log('Outgoing message to', from, ':', reply);
          }
        }
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('Error processing webhook', err);
    res.sendStatus(500);
  }
});

async function sendMessage(to, bodyText) {
  const url = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    to,
    text: { body: bodyText }
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
    console.error('Error sending message', err.response && err.response.data ? err.response.data : err.message);
    throw err;
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
