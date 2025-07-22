import mongoose from 'mongoose';

const signedPdfSchema = new mongoose.Schema({
  url: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
});

const SignedPdf = mongoose.model('SignedPdf', signedPdfSchema);

export default SignedPdf;
