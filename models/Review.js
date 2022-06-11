import mongoose from "mongoose";
import paginate from "mongoose-paginate";

const reviewSchema = new mongoose.Schema({
    relatedProduct: {
        type: mongoose.SchemaTypes.ObjectId,
        index: true,
        required: true
    },
    relatedUser: {
        type: mongoose.SchemaTypes.ObjectId,
        index: true,
        required: true
    },
    reviewerName: {
        type: String,
        required: true
    },
    text: {
        type: String,
        default: "",
    },
    rating: {
        type: Number,
        min: 1,
        max: 5,
        required: true,
        enum: [1, 2, 3, 4, 5]
    },
    createdDate: {
        type: Date,
        default: Date.now,
        required: true
    },
    isVerifiedPurchase: {
        type: Boolean,
        required: true
    }
});

reviewSchema.plugin(paginate);

export default mongoose.model("Review", reviewSchema);