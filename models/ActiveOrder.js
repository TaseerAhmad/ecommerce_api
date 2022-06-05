import mongoose from "mongoose";
import orderStateSubSchema from "./OrderState.js";

const activeOrderSchema = new mongoose.Schema({
    relatedUser: {
        type: mongoose.Types.ObjectId,
        required: true,
        ref: "User",
        index: true
    },
    shippingAddress: {
        type: mongoose.Types.ObjectId,
        required: true,
        ref: "Address"
    },
    relatedProduct: {
        type: mongoose.Types.ObjectId,
        ref: "Product",
        required: true
    },
    orderId: {
        type: String,
        minlength: 12,
        unique: true,
        index: true,
        required: true
    },
    quantity: {
        type: Number,
        min: 1,
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