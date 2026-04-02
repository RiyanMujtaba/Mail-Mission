require('dotenv').config();
const express    = require('express');
const { google } = require('googleapis');
const Groq = require('groq-sdk');
const session    = require('express-session');
const path       = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'mail-mission-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// ── Google OAuth2 ─────────────────────────────────────────────────
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.REDIRECT_URI || `http://localhost:${PORT}/auth/callback`
);

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
];

// BETA: expanded scopes for taking actions
const SCOPES_BETA = [
  ...SCOPES,
  'https://www.googleapis.com/auth/gmail.modify',  // archive, label, mark read
  'https://www.googleapis.com/auth/gmail.compose',  // create drafts
  'https://www.googleapis.com/auth/gmail.send'      // send emails
];

// ── Groq ──────────────────────────────────────────────────────────
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ── In-memory stores ──────────────────────────────────────────────
const completedStore = new Map(); // sessionId → Set of task IDs
const cacheStore     = new Map(); // sessionId → last analysis result
const actionLogStore = new Map(); // sessionId → Array of action log entries

// ── BETA: AI agent tools definition ──────────────────────────────
const AGENT_TOOLS = [
  {
    name: 'draft_reply',
    description: 'Create a Gmail draft reply to an email that needs a response. Use this for REPLY-category tasks when the user has granted draft permission.',
    input_schema: {
      type: 'object',
      properties: {
        email_id:  { type: 'string', description: 'Gmail message ID to reply to' },
        to:        { type: 'string', description: 'Recipient email address' },
        subject:   { type: 'string', description: 'Reply subject line (usually "Re: <original subject>")' },
        body:      { type: 'string', description: 'Full reply body text. Be professional and concise.' }
      },
      required: ['email_id', 'to', 'subject', 'body']
    }
  },
  {
    name: 'send_reply',
    description: 'Send a reply email immediately. Only use this if the user has explicitly enabled auto-send in their BETA permissions. For most cases, use draft_reply instead.',
    input_schema: {
      type: 'object',
      properties: {
        email_id:  { type: 'string', description: 'Gmail message ID to reply to' },
        to:        { type: 'string', description: 'Recipient email address' },
        subject:   { type: 'string', description: 'Reply subject line' },
        body:      { type: 'string', description: 'Full reply body text' }
      },
      required: ['email_id', 'to', 'subject', 'body']
    }
  },
  {
    name: 'archive_email',
    description: 'Archive an email (removes from inbox but keeps in All Mail). Use for newsletters, FYI emails, or emails with no action needed.',
    input_schema: {
      type: 'object',
      properties: {
        email_id: { type: 'string', description: 'Gmail message ID to archive' },
        reason:   { type: 'string', description: 'Short reason why this email was archived' }
      },
      required: ['email_id', 'reason']
    }
  },
  {
    name: 'mark_read',
    description: 'Mark an email as read.',
    input_schema: {
      type: 'object',
      properties: {
        email_id: { type: 'string', description: 'Gmail message ID to mark as read' }
      },
      required: ['email_id']
    }
  },
  {
    name: 'add_label',
    description: 'Add a Gmail label to an email for priority tracking.',
    input_schema: {
      type: 'object',
      properties: {
        email_id:   { type: 'string', description: 'Gmail message ID' },
        label_name: { type: 'string', description: 'Label name: MISSION/HIGH, MISSION/MEDIUM, or MISSION/LOW' }
      },
      required: ['email_id', 'label_name']
    }
  }
];

// ── Auth Routes ───────────────────────────────────────────────────
app.get('/auth/google', (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  });
  res.redirect(url);
});

// BETA: re-authorize with expanded Gmail scopes
app.get('/auth/google-beta', (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES_BETA,
    prompt: 'consent'
  });
  res.redirect(url);
});

app.get('/auth/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.redirect('/?error=access_denied');

  try {
    const { tokens } = await oauth2Client.getToken(code);
    req.session.tokens    = tokens;
    // Check if we got the expanded BETA scopes
    const granted = tokens.scope || '';
    req.session.betaAuthorized = granted.includes('gmail.modify') && granted.includes('gmail.send');

    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();
    req.session.user = { name: data.name, email: data.email, picture: data.picture };

    res.redirect(req.session.betaAuthorized ? '/?beta_connected=1' : '/?connected=1');
  } catch (err) {
    console.error('Auth callback error:', err.message);
    res.redirect('/?error=auth_failed');
  }
});

app.get('/auth/logout', (req, res) => {
  const sid = req.session.id;
  completedStore.delete(sid);
  cacheStore.delete(sid);
  actionLogStore.delete(sid);
  req.session.destroy(() => res.redirect('/'));
});

// ── API: status ───────────────────────────────────────────────────
app.get('/api/status', (req, res) => {
  res.json({
    authenticated:   !!req.session.tokens,
    betaAuthorized:  !!req.session.betaAuthorized,
    betaPermissions: req.session.betaPermissions || {},
    user:            req.session.user || null
  });
});

// Save BETA permission settings
app.post('/api/beta/permissions', (req, res) => {
  if (!req.session.tokens) return res.status(401).json({ error: 'Not authenticated' });
  req.session.betaPermissions = req.body; // { draft_replies, auto_archive, mark_read, auto_send }
  res.json({ ok: true, permissions: req.session.betaPermissions });
});

// Get action log
app.get('/api/beta/log', (req, res) => {
  if (!req.session.tokens) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ log: actionLogStore.get(req.session.id) || [] });
});

// ── API: fetch emails ─────────────────────────────────────────────
app.get('/api/emails', async (req, res) => {
  if (!req.session.tokens) return res.status(401).json({ error: 'Not authenticated' });

  try {
    oauth2Client.setCredentials(req.session.tokens);
    const gmail  = google.gmail({ version: 'v1', auth: oauth2Client });
    const limit  = Math.min(parseInt(req.query.limit) || 25, 50);

    const listRes = await gmail.users.messages.list({
      userId: 'me',
      maxResults: limit,
      q: 'in:inbox -category:promotions -category:social -category:updates'
    });

    const messages = listRes.data.messages || [];
    if (!messages.length) return res.json({ emails: [] });

    const emails = await Promise.all(messages.map(async (msg) => {
      const detail = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'full'
      });

      const headers   = detail.data.payload.headers || [];
      const getHeader = (name) =>
        headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      // Extract plain-text body recursively
      let body = '';
      const extractBody = (part) => {
        if (!part) return;
        if (part.mimeType === 'text/plain' && part.body?.data) {
          body += Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
        (part.parts || []).forEach(extractBody);
      };

      if (detail.data.payload.body?.data) {
        body = Buffer.from(detail.data.payload.body.data, 'base64').toString('utf-8');
      } else {
        extractBody(detail.data.payload);
      }

      return {
        id:      msg.id,
        subject: getHeader('subject') || '(No Subject)',
        from:    getHeader('from'),
        date:    getHeader('date'),
        snippet: detail.data.snippet || '',
        body:    body.slice(0, 1500),
        unread:  detail.data.labelIds?.includes('UNREAD') ?? false
      };
    }));

    res.json({ emails });
  } catch (err) {
    console.error('Gmail fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch emails. Check Gmail API permissions.' });
  }
});

// ── API: analyze emails with AI ───────────────────────────────────
app.post('/api/analyze', async (req, res) => {
  if (!req.session.tokens) return res.status(401).json({ error: 'Not authenticated' });

  const { emails } = req.body;
  if (!emails?.length) return res.status(400).json({ error: 'No emails provided' });

  try {
    const sid       = req.session.id;
    const completed = completedStore.get(sid) || new Set();

    // Build email text for AI
    const emailText = emails.map((e, i) => `
=== EMAIL ${i + 1} ===
From: ${e.from}
Subject: ${e.subject}
Date: ${e.date}
Body: ${e.snippet || e.body?.slice(0, 600) || '(empty)'}
`).join('\n');

    // ── Task extraction prompt ────────────────────────────────────
    const taskPrompt = `You are an expert productivity assistant. Analyze these ${emails.length} emails and extract only actionable tasks.

${emailText}

Return ONLY a valid JSON array. No extra text, no markdown, no code blocks. Just the raw array:

[
  {
    "id": "task_1",
    "title": "Action title in max 7 words",
    "detail": "Exactly what needs to be done, one sentence.",
    "from": "Sender name or company",
    "fromEmail": "sender@email.com",
    "priority": "HIGH",
    "category": "REPLY",
    "deadline": null,
    "emailSubject": "original subject line"
  }
]

Priority: HIGH = urgent/from boss/overdue, MEDIUM = needs action soon, LOW = no deadline
Category: REPLY = needs response, ACTION = do something, DEADLINE = has due date, REVIEW = read/approve, INFO = important info
Exclude emails with no action needed. Return [] if none.`;

    const taskResult = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: taskPrompt }],
      temperature: 0.2
    });
    let taskText = taskResult.choices[0].message.content.trim();
    taskText = taskText.replace(/^```[a-z]*\n?/i, '').replace(/```$/,'').trim();

    let tasks = [];
    try {
      tasks = JSON.parse(taskText);
    } catch {
      tasks = [];
    }

    // Mark completed tasks
    tasks = tasks.map(t => ({ ...t, completed: completed.has(t.id) }));

    // ── Daily brief prompt ────────────────────────────────────────
    const briefPrompt = `Write a sharp daily brief based on these emails. Max 4 bullet points. Each starts with •. Be specific — name senders and topics. Focus on what matters most today.

Emails:
${emails.slice(0, 15).map(e => `• ${e.subject} — from ${e.from}: ${e.snippet?.slice(0, 120)}`).join('\n')}

Write only the bullet points, nothing else:`;

    const briefResult = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: briefPrompt }],
      temperature: 0.3
    });

    const result = {
      tasks,
      brief: briefResult.choices[0].message.content.trim(),
      scannedCount: emails.length,
      timestamp: new Date().toISOString()
    };

    // Cache result
    cacheStore.set(sid, result);

    res.json(result);
  } catch (err) {
    console.error('Analysis error FULL:', err);
    res.status(500).json({ error: 'AI analysis failed: ' + err.message });
  }
});

// ── API: mark task complete ───────────────────────────────────────
app.post('/api/tasks/:id/complete', (req, res) => {
  if (!req.session.tokens) return res.status(401).json({ error: 'Not authenticated' });
  const sid       = req.session.id;
  const completed = completedStore.get(sid) || new Set();
  completed.add(req.params.id);
  completedStore.set(sid, completed);
  res.json({ ok: true });
});

app.post('/api/tasks/:id/undo', (req, res) => {
  if (!req.session.tokens) return res.status(401).json({ error: 'Not authenticated' });
  const sid       = req.session.id;
  const completed = completedStore.get(sid) || new Set();
  completed.delete(req.params.id);
  completedStore.set(sid, completed);
  res.json({ ok: true });
});

// ── API: get cached result ────────────────────────────────────────
app.get('/api/cache', (req, res) => {
  if (!req.session.tokens) return res.status(401).json({ error: 'Not authenticated' });
  const cached = cacheStore.get(req.session.id);
  res.json(cached || null);
});

// ── BETA: AI Agent — actually does tasks ─────────────────────────
app.post('/api/beta/run', async (req, res) => {
  if (!req.session.tokens) return res.status(401).json({ error: 'Not authenticated' });

  const { emails, permissions } = req.body;
  if (!emails?.length) return res.status(400).json({ error: 'No emails' });

  const perms = permissions || {};
  const log   = [];

  try {
    oauth2Client.setCredentials(req.session.tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    for (const email of emails) {
      const prompt = `You are an AI email assistant. Analyze this email and decide what action to take based on allowed permissions.

Email:
From: ${email.from}
Subject: ${email.subject}
Body: ${email.body?.slice(0, 800) || email.snippet}

Allowed actions:
${perms.draft_replies ? '- draft_reply: write a professional reply draft' : ''}
${perms.auto_archive ? '- archive: archive this email if it needs no action' : ''}
${perms.mark_read    ? '- mark_read: mark as read after processing' : ''}

Respond with ONLY a JSON object (no markdown):
{
  "action": "draft_reply" | "archive" | "mark_read" | "none",
  "reason": "one sentence why",
  "reply_body": "full reply text if action is draft_reply, else null"
}

If none of the allowed actions apply, use "none".`;

      const result = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2
      });

      let decision;
      try {
        let txt = result.choices[0].message.content.trim();
        txt = txt.replace(/^```[a-z]*\n?/i, '').replace(/```$/, '').trim();
        decision = JSON.parse(txt);
      } catch {
        continue;
      }

      if (decision.action === 'none') continue;

      // Execute the action
      try {
        if (decision.action === 'draft_reply' && perms.draft_replies) {
          // Extract sender email
          const fromMatch = email.from.match(/<(.+?)>/) || [null, email.from];
          const toEmail   = fromMatch[1];

          const replyBody = `${decision.reply_body}\n\n---\nThis reply was drafted by Mail Mission AI.`;
          const rawMsg    = [
            `To: ${toEmail}`,
            `Subject: Re: ${email.subject}`,
            `In-Reply-To: ${email.id}`,
            `Content-Type: text/plain; charset=utf-8`,
            '',
            replyBody
          ].join('\n');

          const encoded = Buffer.from(rawMsg).toString('base64').replace(/\+/g,'-').replace(/\//g,'_');
          await gmail.users.drafts.create({
            userId: 'me',
            requestBody: { message: { raw: encoded, threadId: email.threadId } }
          });

          log.push({ emailId: email.id, subject: email.subject, action: 'draft_reply', reason: decision.reason, preview: decision.reply_body?.slice(0, 120) });

        } else if (decision.action === 'archive' && perms.auto_archive) {
          await gmail.users.messages.modify({
            userId: 'me', id: email.id,
            requestBody: { removeLabelIds: ['INBOX'] }
          });
          log.push({ emailId: email.id, subject: email.subject, action: 'archive', reason: decision.reason });

        } else if (decision.action === 'mark_read' && perms.mark_read) {
          await gmail.users.messages.modify({
            userId: 'me', id: email.id,
            requestBody: { removeLabelIds: ['UNREAD'] }
          });
          log.push({ emailId: email.id, subject: email.subject, action: 'mark_read', reason: decision.reason });
        }
      } catch (actionErr) {
        log.push({ emailId: email.id, subject: email.subject, action: 'error', reason: actionErr.message });
      }
    }

    actionLogStore.set(req.session.id, log);
    res.json({ log });

  } catch (err) {
    console.error('BETA agent error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Start server ──────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════╗`);
  console.log(`║  MAIL MISSION — running on port ${PORT}  ║`);
  console.log(`╚══════════════════════════════════════╝\n`);
  console.log(`Open: http://localhost:${PORT}\n`);
});
