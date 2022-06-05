import mongoose from "mongoose";
import paginate from "mongoose-paginate";

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    description: String,
    createdAt: {
        type: Date,
        default: Date.now,
        required: true
    },
    productCount: {
        type: Number,
        min: 0,
        default: 0,
        required: true
    },
    createdByUserId: {
        type: mongoose.Types.ObjectId,
        required: true,
        ref: "User"
    }
});

categorySchema.plugin(paginate);

export default mongoose.model("Category", categorySchema);