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

const activeOrderSchema = new mongoose.Schema({
    relatedUser: {
        type: mongoose.Types.ObjectId,
        required: true,
        ref: "User",
        index: true
    },
    shippingAddress: {
        city: String,
        contact: String,
        address: String
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
        required: true
    },
    orderedOn: {
        type: Date,
        required: true,
        default: Date.now
    },
    orderState: orderStateSubSchema
});

export default mongoose.model("ActiveOrder", activeOrderSchema);