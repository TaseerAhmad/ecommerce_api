import mongoose from "mongoose";
import userRole from "../helpers/user.roles.js";

const managementSchema = new mongoose.Schema({
    userId: {
        type: mongoose.SchemaTypes.ObjectId,
        index: true,
    },
    createDate: {
        type: Date,
        required: true,
        default: Date.now
    },
    updatedOn: {
        type: Date
    },
    role: {
        type: String,
        enum: [userRole],
        required: true
    },
    addedBy: {
        type: mongoose.SchemaTypes.ObjectId,
        required: true
    }
});

export default mongoose.model("Management", managementSchema);