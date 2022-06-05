import mongoose from "mongoose";
import userRole from "../helpers/user.roles.js";

const userSchema = new mongoose.Schema({
  role: {
    type: String,
    default: userRole.CUSTOMER,
    enum: [userRole],
    required: true
  },
  email: {
    type: String,
    unique: true,
    index: true,
    required: true
  },
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  merchantId: {
    type: mongoose.SchemaTypes.ObjectId,
    default: null,
    index: true,
    ref: "Merchant"
  },
  suspendId: {
    type: mongoose.SchemaTypes.ObjectId,
    default: null,
    index: true
  },
  savedDeliveryAddresses: {
    type: Number,
    default: 0,
    max: 5,
    min: 0,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  lastPasswordUpdate: {
    type: Date,
    default: null,
  },
  lastSeen: {
    type: Date,
    default: Date.now,
    required: true
  },
});

export default mongoose.model("User", userSchema);