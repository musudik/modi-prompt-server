import express from "express";
import cors from "cors";
import * as dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT as string, 10) || 3001;

// CORS configuration for Replit
app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'https://mp-client.replit.app',
      process.env.FRONTEND_URL
    ].filter(Boolean),
    credentials: true,
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Serve static files from frontend build
const frontendBuildPath = path.join(__dirname, "../../dist");
app.use(express.static(frontendBuildPath));

// Free OpenAI API Keys from environment variable
const FREE_OPENAI_KEYS: string[] =
  process.env.FREE_OPENAI_KEYS?.split(",") || [];

// Track failed keys to avoid retrying them
const failedKeys = new Set<string>();

// AI Provider configurations (same as original server.ts)
const AI_PROVIDERS = {
  // ... (copy from original server.ts)
};

// API Routes
app.post("/api/generate-prompt", async (req, res) => {
  // ... (copy implementation from original server.ts)
});

app.get("/api/models", async (req, res) => {
  // ... (copy implementation from original server.ts)
});

app.get("/api/key-stats", async (req, res) => {
  // ... (copy implementation from original server.ts)
});

app.post("/api/reset-keys", async (req, res) => {
  // ... (copy implementation from original server.ts)
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    port: PORT,
  });
});

// Handle React Router - serve index.html for all non-API routes
app.get("*", (req, res) => {
  if (!req.path.startsWith("/api") && !req.path.startsWith("/health")) {
    res.sendFile(path.join(frontendBuildPath, "index.html"));
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Modi-Prompt server running on port ${PORT}`);
  console.log(
    `📱 Frontend: https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`,
  );
  console.log(
    `🔧 API: https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co/api`,
  );
  console.log(
    `💚 Health: https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co/health`,
  );
});
