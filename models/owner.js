const mongoose = require("mongoose");

const ownerSchema = new mongoose.Schema(
  {
    owner_id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    name: {
      type: String,
      required: [true, "Owner name is required"],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
    },
    house_address: {
      type: String,
      required: [true, "House address is required"],
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Owner", ownerSchema);