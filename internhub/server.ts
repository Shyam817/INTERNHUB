import express from 'express';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { GoogleGenAI } from "@google/genai"; // ✅ ADDED

dotenv.config(); 

const PORT = process.env.PORT || 3000; // ✅ FIXED
const DB_FILE = path.join(process.cwd(), 'db.json');
const JWT_SECRET = process.env.JWT_SECRET || 'internhub-secret-key';

// 🔥 GEMINI INIT
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

// --- Database Mock ---
const getDB = () => {
  if (!fs.existsSync(DB_FILE)) {
    const initialDB = { 
      users: [], 
      tasks: [], 
      submissions: [], 
      reviews: [], 
      messages: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialDB, null, 2));
    return initialDB;
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
};

const saveDB = (db: any) => {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
};

// --- Email Service ---
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: Number(process.env.SMTP_PORT) || 587,
  auth: {
    user: process.env.SMTP_USER || 'ethereal-user',
    pass: process.env.SMTP_PASS || 'ethereal-pass',
  },
});

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*' }
  });

  app.use(express.json());

  /* =========================
     🔥 GEMINI ROUTES
  ========================= */

  // SEARCH
  app.post('/api/gemini/search', async (req, res) => {
    try {
      const { query, domain } = req.body;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Find 10 internship opportunities for ${domain} based on "${query}".

Return JSON array:
- title
- company
- location
- link
- deadline
- description`,
      });

      res.json(JSON.parse(response.text || "[]"));
    } catch (err) {
      console.error("Search error:", err);
      res.status(500).json({ error: "Search failed" });
    }
  });

  // ANALYZE
  app.post('/api/gemini/analyze', async (req, res) => {
    try {
      const { text, domain } = req.body;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze this resume for ${domain}:

${text}

Return JSON:
- resumeScore
- matchPct
- advantages
- disadvantages
- found
- missing
- suggestions
- roadmap`,
      });

      res.json(JSON.parse(response.text || "{}"));
    } catch (err) {
      console.error("Analyze error:", err);
      res.status(500).json({ error: "Analyze failed" });
    }
  });

  // MATCH (with domain restored)
  app.post('/api/gemini/match', async (req, res) => {
    try {
      const { jd, resumeText, domain } = req.body;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `You are a recruiter for ${domain} roles.

Compare this job description and resume.

Job Description:
${jd}

Resume:
${resumeText}

Return JSON:
- pct
- matched
- missing
- suggestions`,
      });

      res.json(JSON.parse(response.text || "{}"));
    } catch (err) {
      console.error("Match error:", err);
      res.status(500).json({ error: "Match failed" });
    }
  });

  /* =========================
     YOUR ORIGINAL ROUTES
  ========================= */

  // --- Auth Routes ---
  app.post('/api/auth/signup', async (req, res) => {
    const { name, email, username, password, role, domain, mentorCode } = req.body;
    const db = getDB();

    if (db.users.find((u: any) => u.email === email || u.username === username)) {
      return res.status(400).json({ success: false, message: 'User or email already exists' });
    }

    if (role === 'mentor' && mentorCode !== '123') {
      return res.status(400).json({ success: false, message: 'Invalid mentor access code' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      email,
      username,
      password: hashedPassword,
      role,
      domain,
      score: 0,
      tasks_completed: 0,
      isVerified: true
    };

    db.users.push(newUser);
    saveDB(db);

    const token = jwt.sign({ id: newUser.id, role: newUser.role }, JWT_SECRET);
    res.json({ success: true, token, user: newUser });
  });

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const db = getDB();

    const user = db.users.find((u: any) => u.email === email || u.username === email);
    if (!user) return res.status(401).json({ success: false });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ success: false });

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET);
    res.json({ success: true, token, user });
  });

  /* =========================
     SOCKET + VITE
  ========================= */

  io.on('connection', (socket) => {
    socket.on('join_room', (room) => socket.join(room));

    socket.on('send_message', (data) => {
      const db = getDB();
      const msg = {
        id: Date.now().toString(),
        ...data,
        time: new Date().toLocaleTimeString()
      };
      db.messages.push(msg);
      saveDB(db);
      io.to(data.domain).emit('receive_message', msg);
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();