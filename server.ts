import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', hasGeminiKey: Boolean(process.env.GEMINI_API_KEY) });
});

// Gemini AI Mastering endpoint with fast fallback
app.post('/api/ai-master', async (req, res) => {
  try {
    const {
      metrics,
      mode = 'club',
      trackGenre = 'EDM',
      audioSource = 'demo',
      fileName = 'Track'
    } = req.body;

    // Check if valid GEMINI_API_KEY exists and attempt with strict 2.5s timeout
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 5) {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const prompt = `You are a Grammy-winning audio mastering engineer. Provide optimal mastering parameters for this track in valid JSON:
Genre: ${trackGenre}, Target: ${mode}, RMS: ${metrics?.rmsDb?.toFixed(1) || -18} dBFS, Peak: ${metrics?.peakDb?.toFixed(1) || -1} dBFS.
Format: { "detectedGenre": "${trackGenre}", "targetMode": "${mode}", "targetLufs": -7, "explanation": ["Dynamic EQ applied", "Punchy multiband compression", "Transparent limiting"] }`;

        const geminiPromise = ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: { responseMimeType: 'application/json' }
        });

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Gemini API timeout')), 2000)
        );

        const geminiRes: any = await Promise.race([geminiPromise, timeoutPromise]);
        if (geminiRes?.text) {
          const parsed = JSON.parse(geminiRes.text);
          return res.json({ success: true, aiPowered: true, result: parsed });
        }
      } catch (err: any) {
        // Fallback gracefully without error
        return res.json({ success: true, aiPowered: false, fallback: true, reason: err?.message });
      }
    }

    return res.json({ success: true, aiPowered: false, fallback: true });
  } catch (err: any) {
    res.json({ success: true, aiPowered: false, fallback: true });
  }
});

async function startServer() {
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
