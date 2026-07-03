import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  // Create HTTP server
  const server = http.createServer(app);

  // Setup WebSocket server attached to the HTTP server
  const wss = new WebSocketServer({ server });

  // Simple in-memory document state for last-write-wins collaboration
  // documentId -> state object
  const documents: Record<string, any> = {};

  wss.on("connection", (ws, req) => {
    let currentDocId: string | null = null;
    let currentUserInfo: any = null;

    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === 'join') {
          currentDocId = data.docId;
          currentUserInfo = data.userInfo;
          ws.send(JSON.stringify({ type: 'init', state: documents[currentDocId!] || null }));
        } else if (data.type === 'update') {
          if (currentDocId) {
            documents[currentDocId] = { ...documents[currentDocId], ...data.state };
            // Broadcast to other clients
            wss.clients.forEach(client => {
              if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'update', state: data.state }));
              }
            });
          }
        } else if (data.type === 'cursor') {
          // Relay cursor position
          wss.clients.forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ type: 'cursor', cursor: data.cursor, user: currentUserInfo }));
            }
          });
        }
      } catch (err) {
        console.error('WS Error:', err);
      }
    });

    ws.on("close", () => {
      // Clean up cursor on disconnect
      if (currentDocId && currentUserInfo) {
         wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'cursor_leave', userId: currentUserInfo.uid }));
          }
        });
      }
    });
  });

  // API routes
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Proxy to ElevenLabs TTS
  app.post("/api/synthesize", async (req, res) => {
    try {
      const { voiceId, text, params } = req.body;
      const clientApiKey = req.headers["x-elevenlabs-key"] as string || req.body.apiKey;
      const apiKey = clientApiKey || process.env.ELEVENLABS_API_KEY;

      if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
        return res.status(400).json({ 
          error: "ELEVENLABS_API_KEY is not configured on the server. Please add a valid API key to your settings or environment variables." 
        });
      }

      if (!voiceId) {
        return res.status(400).json({ error: "voiceId is required" });
      }

      if (!text) {
        return res.status(400).json({ error: "text is required" });
      }

      // Default ElevenLabs TTS values
      const stability = params?.stability ? (params.stability / 100) : 0.71;
      const similarity_boost = params?.accentIntensity ? (params.accentIntensity / 100) : 0.75;
      
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability,
            similarity_boost,
          }
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("ElevenLabs API error:", errText);
        return res.status(response.status).json({ error: `ElevenLabs synthesis failed: ${errText}` });
      }

      const audioBuffer = await response.arrayBuffer();
      res.setHeader("Content-Type", "audio/mpeg");
      res.send(Buffer.from(audioBuffer));
    } catch (err: any) {
      console.error("Synthesize API route error:", err);
      res.status(500).json({ error: err.message || "Internal Server Error" });
    }
  });

  // Proxy to ElevenLabs Voice Add/Clone
  app.post("/api/voices/add", async (req, res) => {
    try {
      const { name, description, base64Audio, mimeType } = req.body;
      const clientApiKey = req.headers["x-elevenlabs-key"] as string || req.body.apiKey;
      const apiKey = clientApiKey || process.env.ELEVENLABS_API_KEY;

      if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
        return res.status(400).json({ 
          error: "ELEVENLABS_API_KEY is not configured on the server. Please add a valid API key to your settings or environment variables." 
        });
      }

      if (!name) {
        return res.status(400).json({ error: "name is required" });
      }

      if (!base64Audio) {
        return res.status(400).json({ error: "base64Audio sample is required" });
      }

      // Convert base64 to Blob for ElevenLabs multipart form-data
      const buffer = Buffer.from(base64Audio, 'base64');
      const blob = new Blob([buffer], { type: mimeType || 'audio/wav' });
      
      const formData = new FormData();
      formData.append("name", name);
      if (description) {
        formData.append("description", description);
      }
      formData.append("files", blob, "sample.wav");

      const response = await fetch("https://api.elevenlabs.io/v1/voices/add", {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
        },
        body: formData,
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("ElevenLabs add voice error:", errText);
        return res.status(response.status).json({ error: `ElevenLabs voice creation failed: ${errText}` });
      }

      const data = await response.json();
      res.json(data);
    } catch (err: any) {
      console.error("Add Voice API route error:", err);
      res.status(500).json({ error: err.message || "Internal Server Error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
