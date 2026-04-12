const mongoose = require("mongoose");

const familyIdProofSchema = new mongoose.Schema(
  {
    // Links this ID proof to the family head
    family_id: {
      type    : mongoose.Schema.Types.ObjectId,
      ref     : "FamilyHead",
      required: [true, "Family head reference is required"],
    },

    id_proof_type: {
      type    : String,
      required: [true, "ID proof type is required"],
      enum    : [
        "Aadhaar",
        "Voter ID",
        "PAN",
        "Passport",
        "Driving Licence",
      ],
    },

    id_proof_number: {
      type    : String,
      required: [true, "ID proof number is required"],
      trim    : true,
    },

    // ── Uploaded ID proof image (stored as Buffer) ──
    proof_image: {
      data    : { type: Buffer },
      mimetype: { type: String },
      filename: { type: String },
    },

    uploaded_at: {
      type   : Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("FamilyIdProof", familyIdProofSchema);