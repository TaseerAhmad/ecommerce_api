import mongoose from "mongoose";

const createSubSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    description: String,
    productCount: {
        type: Number,
        default: 0,
        min: 0
    }
}, { _id: false });

const updateSubSchema = new mongoose.Schema({
    updateCategoryId: {
        type: mongoose.Types.ObjectId,
        ref: "Category"
    },
    name: String,
    description: String,
    productCount: {
        type: Number,
        min: 0
    }
}, { _id: false });

const deleteSubSchema = new mongoose.Schema({
    deleteCategoryId: {
        type: mongoose.Types.ObjectId,
        ref: "Category"
    }
}, { _id: false });

const categoryRequestSchema = new mongoose.Schema({
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
        required: true
    },
    requestingDeo: {
        type: mongoose.Types.ObjectId,
        required: true,
        index: true,
        ref: "User"
    }
});

export default mongoose.model("CategoryRequest", categoryRequestSchema);