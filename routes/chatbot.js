import express from "express";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Health check
router.get("/", (req, res) => {
  res.send("Chatbot backend is running with OpenAI!");
});

// Chat endpoint
router.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const systemPrompt = fs.readFileSync(
      path.join(__dirname, "../systemPrompt.txt"),
      "utf8"
    );

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
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

export default router;
