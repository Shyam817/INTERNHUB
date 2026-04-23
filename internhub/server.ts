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
import { GoogleGenAI } from "@google/genai";

dotenv.config(); 

// ✅ FIXED PORT (RENDER SAFE)
const PORT = process.env.PORT || 5000;

// ✅ SAFE PATH
const DB_FILE = path.join(process.cwd(), 'db.json');

// ❗ IMPORTANT: NEVER leave fallback in production
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is missing in environment variables");
}

// 🔥 GEMINI INIT (SAFE)
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

// --- Database ---
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

// --- Email ---
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
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
     GEMINI ROUTES
  ========================= */

  app.post('/api/gemini/search', async (req, res) => {
    try {
      const { query, domain } = req.body;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Find 10 internship opportunities for ${domain} based on "${query}". Return JSON.`,
      });

      res.json(JSON.parse(response.text || "[]"));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Search failed" });
    }
  });

  app.post('/api/gemini/analyze', async (req, res) => {
    try {
      const { text, domain } = req.body;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze resume for ${domain}: ${text}. Return JSON.`,
      });

      res.json(JSON.parse(response.text || "{}"));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Analyze failed" });
    }
  });

  app.post('/api/gemini/match', async (req, res) => {
    try {
      const { jd, resumeText, domain } = req.body;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Compare JD and resume for ${domain}. Return JSON.`,
      });

      res.json(JSON.parse(response.text || "{}"));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Match failed" });
    }
  });

  /* =========================
     AUTH
  ========================= */

  app.post('/api/auth/signup', async (req, res) => {
    const { name, email, username, password, role, domain, mentorCode } = req.body;
    const db = getDB();

    if (db.users.find((u: any) => u.email === email || u.username === username)) {
      return res.status(400).json({ success: false, message: 'User exists' });
    }

    if (role === 'mentor' && mentorCode !== '123') {
      return res.status(400).json({ success: false, message: 'Invalid code' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = {
      id: Date.now().toString(),
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
     SOCKET
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

  /* =========================
     VITE
  ========================= */

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

  // ✅ FINAL START
  httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();