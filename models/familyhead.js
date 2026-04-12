const mongoose = require("mongoose");

const familyHeadSchema = new mongoose.Schema(
  {
    owner_id: {
      type    : mongoose.Schema.Types.ObjectId,
      ref     : "Owner",
      required: [true, "Owner reference is required"],
    },

    // ── Personal Details ──
    head_name: {
      type    : String,
      required: [true, "Family head name is required"],
      trim    : true,
    },
    phone: {
      type    : String,
      required: [true, "Phone number is required"],
      trim    : true,
    },
    occupation: {
      type    : String,
      required: [true, "Occupation is required"],
      trim    : true,
    },
    permanent_address: {
      type    : String,
      required: [true, "Permanent address is required"],
      trim    : true,
    },

    // ── Uploaded profile photo (stored as Buffer) ──
    head_photo: {
      data    : { type: Buffer },
      mimetype: { type: String },
      filename: { type: String },
    },

    // ── Live webcam photo (stored as Buffer) ──
    live_photo: {
      data       : { type: Buffer },
      mimetype   : { type: String, default: "image/jpeg" },
      captured_at: { type: Date,   default: Date.now },
    },

    // ── Auto-updated when members are added/removed ──
    total_members: {
      type   : Number,
      default: 0,
      min    : 0,
    },

    registration_date: {
      type   : Date,
      default: Date.now,
    },

    status: {
      type   : String,
      enum   : ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("FamilyHead", familyHeadSchema);