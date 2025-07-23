import mongoose from 'mongoose';

const signedPdfSchema = new mongoose.Schema({
  clientSignedUrl: { type: String, required: true }, // client-signed document
  adminSignedUrl: { type: String },                  // added later by admin
  uploadedAt: { type: Date, default: Date.now },
});

const SignedPdf = mongoose.model('SignedPdf', signedPdfSchema);

export default SignedPdf;
