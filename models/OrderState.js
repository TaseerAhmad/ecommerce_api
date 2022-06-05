import mongoose from "mongoose";
import orderState from "../helpers/order.states.js";

const orderStateSubSchema = new mongoose.Schema({
    current: {
        type: String,
        required: true,
        enum: [orderState],
        default: orderState.VERFYING
    },
    verifyTime: {
        type: Date,
        required: true,
        immutable: true
    },
    processTime: {
        type: Date,
        immutable: true
    },
    failTime: {
        type: Date,
        immutable: true
    },
    cancelTime: {
        type: Date,
        immutable: true
    },
    transitTime: {
        type: Date,
        immutable: true
    },
    completeTime: {
        type: Date,
        immutable: true
    }
}, { _id: false });

export default orderStateSubSchema;