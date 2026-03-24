const mongoose = require("mongoose");

const singleIdProofSchema = new mongoose.Schema(
  {
    tenant_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SingleTenant",
      required: [true, "Single tenant reference is required"],
    },
    id_proof_type: {
      type: String,
      required: [true, "ID proof type is required"],
      enum: ["Aadhaar", "Voter ID", "PAN", "Passport", "Driving Licence"],
    },
    id_proof_number: {
      type: String,
      required: [true, "ID proof number is required"],
      trim: true,
    },

    // Uploaded ID proof image
    proof_image: {
      data: { type: Buffer, required: [true, "ID proof image is required"] },
      mimetype: { type: String, required: true }, // e.g. image/jpeg or image/png
      filename: { type: String, required: true },
    },

    uploaded_at: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SingleIdProof", singleIdProofSchema);