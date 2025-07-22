import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("MongoDB connection error:", err));

// Create schema and model
const SignedPDFSchema = new mongoose.Schema({
  filename: String,
  url: String,
  uploadedAt: { type: Date, default: Date.now }
});
const SignedPDF = mongoose.model("SignedPDF", SignedPDFSchema);

// Multer storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../uploads"));
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

// Serve uploaded PDFs publicly
router.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Endpoint to handle signed PDF upload
router.post("/upload-signed-pdf", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No file uploaded" });
  }

  const fileUrl = `${req.protocol}://${req.get("host")}/api/uploads/${req.file.filename}`;

  try {
    const newPDF = new SignedPDF({
      filename: req.file.filename,
      url: fileUrl,
    });
    await newPDF.save();

    res.status(200).json({ success: true, url: fileUrl });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to save to DB" });
  }
});

export default router;
