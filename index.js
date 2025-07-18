import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import fs from "fs";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/", (req, res) => {
  res.send("Chatbot backend is running!");
});

// Chat endpoint
app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Load system prompt from file
    const systemPromptPath = path.join(__dirname, "systemPrompt.txt");
    const systemPrompt = fs.readFileSync(systemPromptPath, "utf8");

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
      }),
    });

    const data = await response.json();
    const botReply = data.choices?.[0]?.message?.content || "Sorry, I couldn't get a response.";

    res.status(200).json({ reply: botReply });
  } catch (error) {
    console.error("Chatbot API error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
