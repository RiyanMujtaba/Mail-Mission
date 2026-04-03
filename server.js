require('dotenv').config();
const express    = require('express');
const { google } = require('googleapis');
const Groq        = require('groq-sdk');
const session    = require('express-session');
const FileStore  = require('session-file-store')(session);
const path       = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  store: new FileStore({
    path: './sessions',
    ttl: 30 * 24 * 60 * 60, // 30 days
    reapInterval: 24 * 60 * 60,
    logFn: () => {}
  }),
  secret: process.env.SESSION_SECRET || 'mail-mission-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 days
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
const FAST_MODEL = 'llama-3.1-8b-instant';   // small, uses fewer tokens
const SMART_MODEL = 'llama-3.3-70b-versatile'; // for task extraction

// ── In-memory stores ──────────────────────────────────────────────
const completedStore = new Map(); // sessionId → Set of task IDs
const cacheStore     = new Map(); // sessionId → last analysis result
const actionLogStore = new Map(); // sessionId → Array of action log entries

// ── Groq helper (module-level so all routes can use it) ───────────
const groqCall = async (messages, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await groq.chat.completions.create({ model: FAST_MODEL, messages, temperature: 0.2 });
    } catch (err) {
      if (err.status === 429 && i < retries - 1) {
        const wait = (parseInt(err.message.match(/(\d+)s/)?.[1] || '15') + 1) * 1000;
        await new Promise(r => setTimeout(r, wait));
      } else throw err;
    }
  }
};

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
    const limit  = Math.min(parseInt(req.query.limit) || 25, 50); // up to 50

    const listRes = await gmail.users.messages.list({
      userId: 'me',
      maxResults: limit,
      labelIds: ['INBOX']
    });

    const messages = listRes.data.messages || [];
    if (!messages.length) return res.json({ emails: [] });

    // Use metadata format — much faster, gives headers + snippet, skips full body
    const emails = await Promise.all(messages.map(async (msg) => {
      const detail = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date']
      });

      const headers   = detail.data.payload?.headers || [];
      const getHeader = (name) =>
        headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      return {
        id:       msg.id,
        threadId: detail.data.threadId,
        subject:  getHeader('subject') || '(No Subject)',
        from:     getHeader('from'),
        date:     getHeader('date'),
        snippet:  detail.data.snippet || '',
        unread:   detail.data.labelIds?.includes('UNREAD') ?? false
      };
    }));

    // Sort newest first
    emails.sort((a, b) => new Date(b.date) - new Date(a.date));

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

    // ── Detect promos server-side ──────────────────────────────────────────
    const isPromo = e => {
      const addr = ((e.from || '').match(/<(.+?)>/) || [])[1] || e.from || '';
      const subj = (e.subject || '').toLowerCase();
      // Automated/marketing sender prefixes
      if (/^(noreply|no-reply|donotreply|do-not-reply|notifications?|newsletter|mailer-daemon|bounce|postmaster|alerts?|promotions?|deals?|offers?|coupons?|savings?|discounts?|specials?|unsubscribe|marketing|promo|shop|store|news|digest|weekly|daily|monthly)@/i.test(addr)) return true;
      // Known ESP / marketing infrastructure domains
      if (/@(amazonses|sendgrid|mailchimp|constantcontact|klaviyo|mailgun|sparkpost|salesforce|hubspot|marketo|braze|iterable|omnisend|drip|activecampaign|campaignmonitor|sailthru|moengage|blueshift|emarsys|responsys|exacttarget)\./i.test(addr)) return true;
      // Marketing subdomain patterns: email@em.target.com, email@e.amazon.com, email@email.brand.com
      if (/^[^@]+@(em\d*|email|e|mktg|marketing|promo|news|deals|offers|shop)\./i.test(addr)) return true;
      // Subject-based: clearly promotional (discount/sale language only — not invoice/order/payment)
      if (/(\d+%\s*off|\bflash sale\b|\bblack friday\b|\bcyber monday\b|\bsummer sale\b|\bwinter sale\b|\bclearance sale\b|\bfree shipping\b|\bcoupon code\b|\bpromo code\b|\bdiscount code\b|\bspecial offer\b|\bexclusive (deal|offer)\b|\blimited time offer\b|\bshop now\b)/i.test(subj)) return true;
      return false;
    };
    const promoEmails = emails.filter(e => isPromo(e));
    const realEmails  = emails.filter(e => !isPromo(e));

    // ── Step 1: Extract tasks via AI (real emails only) ───────────
    const emailLines = realEmails.map((e, i) =>
      `[${i}] "${e.subject}" | ${e.from.replace(/<.*?>/, '').trim()} | ${(e.snippet||'').slice(0,60)}`
    ).join('\n');

    const taskPrompt = `Return ONLY a valid JSON array of tasks. No markdown, no explanation.
Each object: {"i":0,"title":"short action phrase","detail":"one sentence what to do","priority":"HIGH","category":"REPLY","deadline":null}
i = the email index from the list.
priority: HIGH=urgent/overdue/from boss, MEDIUM=needs reply/review, LOW=FYI
category: REPLY/ACTION/DEADLINE/REVIEW/INFO
INCLUDE: emails from real people or businesses needing a real response.
SKIP completely (return nothing for these): promotional/marketing emails, sale/discount offers, newsletters, shipping notifications, order confirmations, automated billing summaries, subscription digests, or any email whose subject contains "% off", "sale", "deal", "coupon", "promo", "newsletter", "unsubscribe", "free shipping", or similar promotional language.
Emails:
${emailLines}`;

    const taskRes = await groqCall([{ role: 'user', content: taskPrompt }]);
    let taskRaw = taskRes.choices[0].message.content.trim()
      .replace(/^```[a-z]*\n?/i, '').replace(/```$/, '').trim();

    console.log('AI task response:', taskRaw.slice(0, 400));

    let aiTasks = [];
    try { aiTasks = JSON.parse(taskRaw); }
    catch {
      const m = taskRaw.match(/\[[\s\S]*\]/);
      if (m) try { aiTasks = JSON.parse(m[0]); } catch { aiTasks = []; }
    }
    if (!Array.isArray(aiTasks)) aiTasks = [];

    // Build tasks — map AI result back to source emails by index
    let tasks = aiTasks.map((t, pos) => {
      const src = emails[t.i ?? pos] || emails[pos] || emails[0] || {};
      return {
        id:           `t_${Date.now()}_${pos}`,
        title:        (t.title  || src.subject || 'Task').slice(0, 60),
        detail:       (t.detail || src.snippet || '').slice(0, 150),
        from:         (src.from || '').replace(/<.*?>/, '').trim(),
        fromEmail:    (src.from?.match(/<(.+?)>/) || [])[1] || '',
        priority:     ['HIGH','MEDIUM','LOW'].includes(t.priority) ? t.priority : 'MEDIUM',
        category:     t.category || 'REPLY',
        deadline:     t.deadline || null,
        emailSubject: src.subject || ''
      };
    });

    // Fallback: if AI returned nothing, make tasks from real emails
    if (!tasks.length) {
      tasks = realEmails.slice(0, 15).map((e, i) => ({
        id:           `fb_${Date.now()}_${i}`,
        title:        (e.subject || 'Email').slice(0, 60),
        detail:       (e.snippet || '').slice(0, 150),
        from:         (e.from || '').replace(/<.*?>/, '').trim(),
        fromEmail:    (e.from?.match(/<(.+?)>/) || [])[1] || '',
        priority:     'MEDIUM',
        category:     'REPLY',
        deadline:     null,
        emailSubject: e.subject || ''
      }));
    }

    // Completed state persists by email subject across scans
    tasks = tasks.map(t => ({ ...t, completed: completed.has(t.emailSubject) }));

    // ── Step 2: Build brief (no promos in important or everything else) ──
    const prioOrder   = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    const sortedTasks = [...tasks].sort((a, b) => (prioOrder[a.priority] ?? 3) - (prioOrder[b.priority] ?? 3));

    const importantLines = sortedTasks.length
      ? sortedTasks.map(t => {
          const tag = t.priority === 'HIGH' ? '🔴' : t.priority === 'MEDIUM' ? '🟡' : '🟢';
          return `• ${tag} ${t.title} (${t.from})${t.deadline ? ' — ' + t.deadline : ''}`;
        }).join('\n')
      : '• Nothing urgent — inbox looking clean.';

    const taskSubjectSet = new Set(tasks.map(t => t.emailSubject));
    const otherReal = realEmails.filter(e => !taskSubjectSet.has(e.subject)).slice(0, 5);
    const otherLines = otherReal.map(e => `• ${(e.subject || '').slice(0, 55)}`).join('\n') || '• No other emails.';

    const brief = `⚡ IMPORTANT\n${importantLines}\n\n📬 EVERYTHING ELSE\n${otherLines}`;

    const result = {
      tasks,
      brief,
      promos:       promoEmails,
      scannedCount: emails.length,
      timestamp:    new Date().toISOString()
    };

    // Cache result
    cacheStore.set(sid, result);

    res.json(result);
  } catch (err) {
    console.error('Analysis error FULL:', err);
    res.status(500).json({ error: 'AI analysis failed: ' + err.message });
  }
});

// ── API: mark task complete (keyed by emailSubject for persistence across scans) ──
app.post('/api/tasks/:id/complete', (req, res) => {
  if (!req.session.tokens) return res.status(401).json({ error: 'Not authenticated' });
  const sid       = req.session.id;
  const completed = completedStore.get(sid) || new Set();
  const subject   = req.body.emailSubject || req.params.id;
  completed.add(subject);
  completedStore.set(sid, completed);
  res.json({ ok: true });
});

app.post('/api/tasks/:id/undo', (req, res) => {
  if (!req.session.tokens) return res.status(401).json({ error: 'Not authenticated' });
  const sid       = req.session.id;
  const completed = completedStore.get(sid) || new Set();
  const subject   = req.body.emailSubject || req.params.id;
  completed.delete(subject);
  completedStore.set(sid, completed);
  res.json({ ok: true });
});

// ── API: get cached result ────────────────────────────────────────
app.get('/api/cache', (req, res) => {
  if (!req.session.tokens) return res.status(401).json({ error: 'Not authenticated' });
  const cached = cacheStore.get(req.session.id);
  res.json(cached || null);
});

// ── BETA: AI Agent ────────────────────────────────────────────────
app.post('/api/beta/run', async (req, res) => {
  if (!req.session.tokens) return res.status(401).json({ error: 'Not authenticated' });

  const { emails, permissions } = req.body;
  if (!emails?.length) return res.status(400).json({ error: 'No emails provided — scan your inbox first.' });

  const perms = permissions || {};
  const log   = [];

  try {
    oauth2Client.setCredentials(req.session.tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Split emails: real people vs automated
    const isAutoSender = e => {
      const addr = ((e.from || '').match(/<(.+?)>/) || [])[1] || e.from || '';
      const subj = (e.subject || '').toLowerCase();
      if (/^(noreply|no-reply|donotreply|do-not-reply|notifications?|newsletter|mailer-daemon|bounce|postmaster|alerts?|promotions?|deals?|offers?|coupons?|savings?|discounts?|specials?|unsubscribe|marketing|promo|shop|store|news|digest|weekly|daily|monthly)@/i.test(addr)) return true;
      if (/@(amazonses|sendgrid|mailchimp|constantcontact|klaviyo|mailgun|sparkpost|salesforce|hubspot|marketo|braze|iterable|omnisend|drip|activecampaign|campaignmonitor|sailthru|moengage|blueshift|emarsys|responsys|exacttarget)\./i.test(addr)) return true;
      if (/^[^@]+@(em\d*|email|e|mktg|marketing|promo|news|deals|offers|shop)\./i.test(addr)) return true;
      if (/(\d+%\s*off|\bflash sale\b|\bblack friday\b|\bcyber monday\b|\bsummer sale\b|\bwinter sale\b|\bclearance sale\b|\bfree shipping\b|\bcoupon code\b|\bpromo code\b|\bdiscount code\b|\bspecial offer\b|\bexclusive (deal|offer)\b|\blimited time offer\b|\bshop now\b)/i.test(subj)) return true;
      return false;
    };
    const realEmails  = emails.filter(e => !isAutoSender(e));
    const autoEmails  = emails.filter(e =>  isAutoSender(e));

    // ── Draft replies for real emails (if permission on) ─────────
    if (perms.draft_replies && realEmails.length) {
      const replyPrompt = `Write short, natural email replies for each email below.
Return ONLY a JSON array (no markdown):
[{"index":0,"reply":"full reply text","reason":"why this reply"}]

Emails:
${realEmails.map((e, i) => `[${i}] From: ${e.from}\nSubject: ${e.subject}\nMessage: ${(e.snippet||'').slice(0,250)}`).join('\n\n')}`;

      const replyRes = await groqCall([{ role: 'user', content: replyPrompt }]);
      let txt = replyRes.choices[0].message.content.trim().replace(/^```[a-z]*\n?/i,'').replace(/```$/,'').trim();
      let replies = [];
      try { replies = JSON.parse(txt); }
      catch { const m = txt.match(/\[[\s\S]*\]/); if (m) try { replies = JSON.parse(m[0]); } catch {} }
      if (!Array.isArray(replies)) replies = [];

      realEmails.forEach((email, idx) => {
        const r = replies.find(x => x.index === idx) || replies[idx];
        if (!r?.reply) {
          log.push({ emailId: email.id, threadId: email.threadId, subject: email.subject, from: email.from, date: email.date, action: 'none', reason: 'AI could not generate a reply for this email' });
          return;
        }
        const toAddr = (email.from.match(/<(.+?)>/) || [null, email.from])[1];
        log.push({
          emailId:   email.id,
          threadId:  email.threadId,
          subject:   email.subject,
          from:      email.from,
          toAddr,
          date:      email.date,
          action:    'proposed_reply',
          reason:    r.reason || 'Reply ready to draft',
          preview:   r.reply
        });
      });
    } else if (!perms.draft_replies) {
      // No draft permission — just log real emails as needing review
      realEmails.forEach(email => {
        log.push({ emailId:email.id, subject:email.subject, from:email.from, date:email.date, action:'none', reason:'Enable "Draft replies" to let the agent write replies' });
      });
    }

    // ── Archive automated/promo emails (if permission on) ────────
    await Promise.all(autoEmails.map(async email => {
      if (perms.auto_archive) {
        try {
          await gmail.users.messages.modify({ userId:'me', id:email.id, requestBody:{ removeLabelIds:['INBOX'] } });
          log.push({ emailId:email.id, subject:email.subject, from:email.from, date:email.date, action:'archive', reason:'Automated/promotional email' });
        } catch(e) {
          log.push({ emailId:email.id, subject:email.subject, from:email.from, date:email.date, action:'error', reason:e.message });
        }
      } else if (perms.mark_read && email.unread) {
        try {
          await gmail.users.messages.modify({ userId:'me', id:email.id, requestBody:{ removeLabelIds:['UNREAD'] } });
          log.push({ emailId:email.id, subject:email.subject, from:email.from, date:email.date, action:'mark_read', reason:'Automated email marked as read' });
        } catch(e) {
          log.push({ emailId:email.id, subject:email.subject, from:email.from, date:email.date, action:'error', reason:e.message });
        }
      } else {
        log.push({ emailId:email.id, subject:email.subject, from:email.from, date:email.date, action:'none', reason:'Automated email — enable auto-archive to clean these up' });
      }
    }));

    actionLogStore.set(req.session.id, log);
    res.json({ log });

  } catch (err) {
    console.error('BETA agent error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── BETA: Send reply directly — never touches Gmail drafts ───────
// Reply text lives only in the website UI until the user clicks SEND.
app.post('/api/beta/send-direct', async (req, res) => {
  if (!req.session.tokens) return res.status(401).json({ error: 'Not authenticated' });
  const { threadId, toAddr, subject, replyText } = req.body;
  if (!toAddr || !replyText) return res.status(400).json({ error: 'Missing toAddr or replyText' });
  try {
    oauth2Client.setCredentials(req.session.tokens);
    const gmail   = google.gmail({ version: 'v1', auth: oauth2Client });
    const body    = `${replyText}\n\n— Sent via Mail Mission AI`;
    const rawMsg  = `To: ${toAddr}\r\nSubject: Re: ${subject || ''}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`;
    const encoded = Buffer.from(rawMsg).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encoded, ...(threadId ? { threadId } : {}) }
    });
    res.json({ ok: true });
  } catch (err) {
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
