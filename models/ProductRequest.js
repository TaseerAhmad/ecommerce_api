import mongoose from "mongoose";

const imgUrlSubSchema = new mongoose.Schema({
    url: String,
    size: Number,
    mimeType: String
}, { _id: false });

const createSubSchema = new mongoose.Schema({
    relatedMerchant: {
        type: mongoose.Types.ObjectId,
        immutable: true,
        required: true,
        ref: "Merchant",
        index: true
    },
    relatedCategory: {
        type: mongoose.Types.ObjectId,
        required: true,
        ref: "Category",
        index: true
    },
    name: {
        type: String,
        required: true,
        index: true
    },
    description: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    productCode: {
        type: String,
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        default: 0,
        min: 0
    },
    images: {
        thumb: imgUrlSubSchema,
        main: [imgUrlSubSchema]
    },
}, { _id: false });

const updateSubSchema = new mongoose.Schema({
    relatedProductId: {
        type: mongoose.Types.ObjectId,
        ref: "Product"
    },
    name: String,
    description: String,
    price: {
        type: Number,
        min: 0
    },
    quantity: {
        type: Number,
        min: 0
    },
    images: {
        thumb: imgUrlSubSchema,
        main: [imgUrlSubSchema]
    },
}, { _id: false });

const deleteSubSchema = new mongoose.Schema({
    relatedProductId: {
        type: mongoose.Types.ObjectId,
        ref: "Product"
    }
}, { _id: false });

const productRequestSchema = new mongoose.Schema({
    isCreate: {
        type: Boolean,
        required: true,
        default: false
    },
    isUpdate: {
        type: Boolean,
        required: true,
        default: false
    },
    isDelete: {
        type: Boolean,
        required: true,
        default: false
    },
    createDoc: createSubSchema,
    updateDoc: updateSubSchema,
    deleteDoc: deleteSubSchema,
    requestCreatedAt: {
        type: Date,
        default: Date.now,
        required: true,
        immutable: true
    },
    requestingDeo: {
        type: mongoose.Types.ObjectId,
        required: true,
        index: true,
        ref: "User",
        immutable: true
    }
});

export default mongoose.model("ProductRequest", productRequestSchema);