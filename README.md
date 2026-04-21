# Mail-Mission 📧

An AI-powered email assistant that connects to your Gmail inbox and extracts actionable tasks, deadlines, and to-dos from your emails automatically.

## Features
- Gmail OAuth2 integration — reads your real inbox
- Groq AI (Llama 3) extracts tasks, deadlines, and action items
- Clean task list UI
- One-click Google sign-in

## Tech Stack
- Node.js + Express
- Gmail API (Google OAuth2)
- Groq API (Llama 3.3 70B)
- HTML / CSS / JavaScript

## Getting Started

```bash
git clone https://github.com/RiyanMujtaba/Mail-Mission
cd Mail-Mission
npm install
```

Set up a Google Cloud project, enable Gmail API, and add your OAuth credentials + Groq API key to a .env file. Then:

```bash
node server.js
```

---
Made by [Riyan Mujtaba](https://riyanmujtaba.github.io)