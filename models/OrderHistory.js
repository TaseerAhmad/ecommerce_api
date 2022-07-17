import mongoose from "mongoose";
import orderStateSubSchema from "./OrderState.js";

const productSubSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Types.ObjectId,
        required: true,
        ref: "Product"
    },
    quantity: {
        type: Number,
        min: 1,
        required: true
    }
});

const orderHistorySchema = new mongoose.Schema({
    relatedUser: {
        type: mongoose.Types.ObjectId,
        required: true,
        immutable: true,
        ref: "User",
        index: true
    },
    orderItems: {
        type: [productSubSchema],
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
    orderedOn: {
        type: Date,
        immutable: true,
        required: true
    },
    shippingAddress: {
        city: String,
        contact: String,
        address: String
    },
    orderState: orderStateSubSchema
});

export default mongoose.model("OrderHistory", orderHistorySchema);