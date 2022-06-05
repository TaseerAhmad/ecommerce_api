import mongoose from "mongoose";
import messageState from "../helpers/message.states.js";

const messageSubSchema = new mongoose.Schema({
    messageType: {
        type: String,
        required: true,
        enum: [messageState]
    },
    header: {
        type: String,
        maxlength: 100,
        required: true
    },
    text: {
        type: String,
        maxlength: 250
    },
    time: {
        type: Date,
        required: true,
        default: Date.now
    }
});

const notificationSchema = new mongoose.Schema({
    relatedUser: {
        type: mongoose.SchemaTypes.ObjectId,
        required: true,
        index: true,
        ref: "User"
    },
    messages: {
        type: [messageSubSchema],
        required: true
    }
});

export default mongoose.model("Notification", notificationSchema);