import mongoose from "mongoose";
import orderStateSubSchema from "./OrderState.js";

const orderHistorySchema = new mongoose.Schema({
    relatedUser: {
        type: mongoose.Types.ObjectId,
        required: true,
        immutable: true,
        index: true
    },
    relatedProduct: {
        type: mongoose.Types.ObjectId,
        immutable: true,
        required: true
    },
    thumbImage: {
        type: String,
        immutable: true,
        required: true
    },
    orderId: {
        type: String,
        minlength: 12,
        unique: true,
        index: true,
        immutable: true,
        required: true
    },
    name: {
        type: String,
        immutable: true,
        required: true
    },
    price: {
        type: Number,
        immutable: true,
        required: true,
        min: 0
    },
    quantity: {
        type: Number,
        immutable: true,
        required: true,
        default: 0,
        min: 0
    },
    orderedOn: {
        type: Date,
        immutable: true,
        required: true
    },
    orderState: orderStateSubSchema
});

export default mongoose.model("OrderHistory", orderHistorySchema);