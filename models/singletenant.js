const mongoose = require("mongoose");

const singleTenantSchema = new mongoose.Schema(
  {
    owner_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Owner",
      required: [true, "Owner reference is required"],
    },
    name: {
      type: String,
      required: [true, "Tenant name is required"],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
    },
    occupation: {
      type: String,
      required: [true, "Occupation is required"],
      trim: true,
    },
    permanent_address: {
      type: String,
      required: [true, "Permanent address is required"],
      trim: true,
    },

    // Uploaded profile photo
    tenant_photo: {
      data: { type: Buffer, required: [true, "Tenant photo is required"] },
      mimetype: { type: String, required: true }, // e.g. image/jpeg
      filename: { type: String, required: true },
    },

    // Live photo captured from camera
    live_photo: {
      data: { type: Buffer, required: [true, "Live photo is required"] },
      mimetype: { type: String, default: "image/jpeg" },
      captured_at: { type: Date, default: Date.now },
    },

    registration_date: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SingleTenant", singleTenantSchema);