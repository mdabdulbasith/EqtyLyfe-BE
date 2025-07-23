import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";

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

// Schema & Model
const SignedPDFSchema = new mongoose.Schema({
  clientSignedUrl: { type: String, required: true },
  adminSignedUrl: { type: String }, // For co-signed PDF
  uploadedAt: { type: Date, default: Date.now }
});
const SignedPDF = mongoose.model("SignedPDF", SignedPDFSchema);

// Multer storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../uploads");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

// Serve uploaded PDFs publicly
router.use("/uploads", express.static(path.join(__dirname, "../uploads")));

/**
 * Upload client-signed PDF
 */
router.post("/upload-signed-pdf", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

  const fileUrl = `${req.protocol}://${req.get("host")}/api/uploads/${req.file.filename}`;

  try {
    const newPDF = new SignedPDF({ clientSignedUrl: fileUrl });
    await newPDF.save();
    res.status(200).json({ success: true, url: fileUrl });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to save to DB" });
  }
});

/**
 * Upload admin co-signed PDF (updates existing record)
 */
router.post("/upload-admin-signed-pdf/:id", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

  const fileUrl = `${req.protocol}://${req.get("host")}/api/uploads/${req.file.filename}`;

  try {
    const updated = await SignedPDF.findByIdAndUpdate(
      req.params.id,
      { adminSignedUrl: fileUrl },
      { new: true }
    );
    if (!updated) return res.status(404).json({ success: false, message: "PDF not found" });

    res.json({ success: true, url: fileUrl });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update PDF" });
  }
});

/**
 * Fetch all signed PDFs
 */
router.get("/signed-pdfs", async (req, res) => {
  try {
    const pdfs = await SignedPDF.find().sort({ uploadedAt: -1 });
    res.json(pdfs);
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch PDFs" });
  }
});

/**
 * Delete a signed PDF
 */
router.delete("/signed-pdfs/:id", async (req, res) => {
  try {
    const pdf = await SignedPDF.findByIdAndDelete(req.params.id);
    if (!pdf) return res.status(404).json({ success: false, message: "PDF not found" });

    // Remove associated files if they exist
    [pdf.clientSignedUrl, pdf.adminSignedUrl].forEach((url) => {
      if (url) {
        const filePath = path.join(__dirname, "../uploads", path.basename(url));
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete PDF" });
  }
});

export default router;
