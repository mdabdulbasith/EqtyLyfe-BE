import cors from "cors";
import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

// Enable CORS for local and production
app.use(
  cors({
    origin: ['https://eqty-lyfe.vercel.app'], // change to ["http://localhost:5173"] for local testing
    // origin: ['http://localhost:5173'],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  })
);

app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.send("Chatbot backend is running with OpenAI!");
});

// Chat endpoint
app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const systemPrompt = fs.readFileSync(
      path.join(__dirname, "systemPrompt.txt"),
      "utf8"
    );

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // or "gpt-4o-mini" for cheaper & faster
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI API error:", data);
      return res.status(response.status).json({
        error: data.error?.message || "Failed to get a response from OpenAI API",
      });
    }

    const botReply =
      data.choices?.[0]?.message?.content || "No response from OpenAI model.";
    res.status(200).json({ reply: botReply });
  } catch (error) {
    console.error("Chatbot server error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
