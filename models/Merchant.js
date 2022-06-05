import mongoose from "mongoose";

const merchantSchema = new mongoose.Schema({
    userId: {
        type: mongoose.SchemaTypes.ObjectId,
        required: true,
        unique: true,
        index: true,
        ref: "User"
    },
    brand: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    description: {
        type: String,
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
    createdAt: {
        type: Date,
        default: Date.now,
        required: true
    },
    addedBy: {
        type: mongoose.SchemaTypes.ObjectId,
        required: true,
        index: true,
    },
    isUnicorn: {
        type: Boolean,
        default: false,
        required: true
    }
});

export default mongoose.model("Merchant", merchantSchema);