# WhatsApp Cloud API Bot (sample)

Overview
- Minimal Node.js + Express webhook for WhatsApp Cloud API.
- Parses simple exam-question queries like `english 2023 q15` and replies with a stored Q/A.

Setup
1. Copy environment file:

```bash
cp .env.example .env
# Fill in values: VERIFY_TOKEN, WHATSAPP_TOKEN, PHONE_NUMBER_ID
```

2. Install dependencies and start server:

```bash
npm install
npm start
```

3. Expose local server with ngrok (for testing):

```bash
ngrok http 3000
```

4. Configure your WhatsApp Cloud webhook URL to: `https://<your-ngrok-domain>/webhook` and set the verify token to the same value as `VERIFY_TOKEN`.

Testing
- Send a message to the WhatsApp business number in the format: `english 2023 q15` and the bot will reply if the entry exists in `data/questions.json`.

Development
- The devcontainer is configured for Node.js v20 and forwards port 3000.
