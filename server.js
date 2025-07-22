import cors from "cors";
import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import mongoose from "mongoose";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

console.log("MONGODB_URI:", process.env.MONGODB_URI);

// Connect to MongoDB Atlas
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ Connected to MongoDB Atlas"))
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

// Schema for signed PDFs
const signedPdfSchema = new mongoose.Schema({
  url: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
});
const SignedPdf = mongoose.model("SignedPdf", signedPdfSchema);

// Schema for finalized submissions
const finalizedSubmissionSchema = new mongoose.Schema({
  documents: [
    {
      id: Number,
      title: String,
      description: String,
      status: String,
      url: String,
    }
  ],
  submittedAt: { type: Date, default: Date.now }
});
const FinalizedSubmission = mongoose.model("FinalizedSubmission", finalizedSubmissionSchema);

// Enable CORS
app.use(
  cors({
    origin: ["https://eqty-lyfe.vercel.app", "http://localhost:5173"], // frontend origins
    methods: ["GET", "POST", "OPTIONS", "DELETE"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json());

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "uploads"));
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  },
});
const upload = multer({ storage });

// Serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Health check
app.get("/", (req, res) => {
  res.send("Backend is running!");
});

// Chat endpoint (optional for chatbot)
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
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || "Failed to get a response from OpenAI API",
      });
    }

    const botReply = data.choices?.[0]?.message?.content || "No response";
    res.status(200).json({ reply: botReply });
  } catch (error) {
    console.error("Chatbot server error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Upload signed PDF
app.post("/api/upload-signed-pdf", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No file uploaded" });
  }

  const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
  try {
    const signedPdf = new SignedPdf({ url: fileUrl });
    await signedPdf.save();

    res.status(200).json({ success: true, url: fileUrl });
  } catch (err) {
    console.error("Error saving signed PDF:", err);
    res.status(500).json({ success: false, message: "Database error" });
  }
});

// Fetch all signed PDFs
app.get("/api/signed-pdfs", async (req, res) => {
  try {
    const signedPdfs = await SignedPdf.find().sort({ uploadedAt: -1 });
    res.status(200).json(signedPdfs);
  } catch (err) {
    console.error("Error fetching signed PDFs:", err);
    res.status(500).json({ message: "Failed to fetch signed PDFs" });
  }
});

// Finalize submission
app.post("/api/finalize-submission", async (req, res) => {
  try {
    const { documents } = req.body;
    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return res.status(400).json({ success: false, message: "No documents provided" });
    }

    const submission = new FinalizedSubmission({ documents });
    await submission.save();

    res.json({ success: true, message: "Documents finalized successfully", submissionId: submission._id });
  } catch (err) {
    console.error("Error finalizing submission:", err);
    res.status(500).json({ success: false, message: "Failed to finalize submission" });
  }
});

app.delete("/api/signed-pdfs/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Find the document first
    const pdf = await SignedPdf.findById(id);
    if (!pdf) {
      return res.status(404).json({ success: false, message: "PDF not found" });
    }

    // Delete the file from the uploads folder
    const filePath = path.join(__dirname, "uploads", path.basename(pdf.url));
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error("Failed to delete file from folder:", err);
        // Don't return here; proceed to delete from DB anyway
      }
    });

    // Delete from MongoDB
    await SignedPdf.findByIdAndDelete(id);

    res.json({ success: true, message: "Signed PDF deleted successfully" });
  } catch (err) {
    console.error("Error deleting signed PDF:", err);
    res.status(500).json({ success: false, message: "Failed to delete signed PDF" });
  }
});


app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
