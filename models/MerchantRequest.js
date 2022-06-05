import mongoose from "mongoose";

const merchantRequestSchema = new mongoose.Schema({
    requestedBy: {
        type: mongoose.SchemaTypes.ObjectId,
        required: true,
        unique: true,
        index: true,
        ref: "User"
    },
    brand: {
        type: String,
        required: true,
        maxlength: 100,
        unique: true,
    },
    description: {
        type: String,
        maxlength: 255,
        required: true,
    },
    businessContact: {
        email: {
            type: String,
            required: true,
        },
        phone: {
            type: String,
            required: true,
        }
    },
    requestDate: {
        type: Date,
        default: Date.now,
        required: true
    }
});

export default mongoose.model("MerchantRequest", merchantRequestSchema);