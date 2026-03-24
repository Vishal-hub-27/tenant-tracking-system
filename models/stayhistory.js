const mongoose = require("mongoose");

const stayHistorySchema = new mongoose.Schema({
  owner_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Owner", // assuming you have Owner model
    required: true
  },

  tenant_ref_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: "tenant_type_model" // dynamic reference
  },

  tenant_type_model: {
    type: String,
    required: true,
    enum: ["SingleTenant", "FamilyTenant"] // you can add more if needed
  },

  tenant_type: {
    type: String,
    required: true,
    enum: ["single", "family"]
  },

  move_in_date: {
    type: Date,
    required: true,
    default: Date.now
  },

  move_out_date: {
    type: Date,
    default: null
  }

}, { timestamps: true });

module.exports = mongoose.model("StayHistory", stayHistorySchema);