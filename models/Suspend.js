import mongoose from "mongoose";

const suspendSchema = new mongoose.Schema({
    userId: {
        type: mongoose.SchemaTypes.ObjectId,
        required: true,
        unique: true,
        index: true,
    },
    suspendedOn: {
        type: Date,
        default: Date.now,
        required: true
    },
    reason: String
});

export default mongoose.model("Suspend", suspendSchema);