const mongoose = require("mongoose");

const familyMemberSchema = new mongoose.Schema(
  {
    // Links this member to their family head
    family_id: {
      type    : mongoose.Schema.Types.ObjectId,
      ref     : "FamilyHead",
      required: [true, "Family head reference is required"],
    },

    // ── Personal Details ──
    name: {
      type    : String,
      required: [true, "Member name is required"],
      trim    : true,
    },
    age: {
      type    : Number,
      required: [true, "Age is required"],
      min     : [0, "Age cannot be negative"],
    },
    relation: {
      type    : String,
      required: [true, "Relation to family head is required"],
      enum    : [
        "Spouse",
        "Son",
        "Daughter",
        "Father",
        "Mother",
        "Brother",
        "Sister",
        "Other",
      ],
    },
    occupation: {
      type   : String,
      trim   : true,
      default: "Not specified",
    },
    phone: {
      type : String,
      trim : true,
      default: "",
    },

    // ── Member photo (stored as Buffer) ──
    member_photo: {
      data    : { type: Buffer },
      mimetype: { type: String },
      filename: { type: String },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("FamilyMember", familyMemberSchema);