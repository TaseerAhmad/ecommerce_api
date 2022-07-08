import mongoose from "mongoose";
import paginate from "mongoose-paginate";

const statSubSchema = new mongoose.Schema({
    oneStar: {
        type: Number,
        default: 0,
        min: 0,
        required: true
    },
    twoStar: {
        type: Number,
        default: 0,
        min: 0,
        required: true
    },
    threeStar: {
        type: Number,
        default: 0,
        min: 0,
        required: true
    },
    fourStar: {
        type: Number,
        default: 0,
        min: 0,
        required: true
    },
    fiveStar: {
        type: Number,
        default: 0,
        min: 0,
        required: true
    }
}, { _id: false });

const ratingSubSchema = new mongoose.Schema({
    count: {
        type: Number,
        min: 0,
        default: 0,
        required: true
    },
    average: {
        type: mongoose.Types.Decimal128,
        min: 0.0,
        default: 0.0,
        required: true
    },
    stats: statSubSchema
}, { _id: false });

const imgUrlSubSchema = new mongoose.Schema({
    url: String,
    size: Number,
    mimeType: String
}, { _id: false });

const productSchema = new mongoose.Schema({
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
    productCode: {
        type: String,
        unique: true,
        required: true,
        index: true,
        immutable: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    quantity: {
        type: Number,
        required: true,
        default: 0
    },
    controls: {
        allowNonVerifiedBuyerReviews: {
            type: Boolean,
            default: true,
            required: true
        },
        isPublished: {
            type: Boolean,
            default: false,
            required: true
        },
        isDiscounted: {
            type: Boolean,
            default: false,
            required: true
        },
        discount: {
            type: Number,
            default: 0,
            required: true
        }
    },
    images: {
        thumb: imgUrlSubSchema,
        main: [imgUrlSubSchema]
    },
    rating: {
        type: ratingSubSchema,
        default: () => ({})
    },
    addedOn: {
        type: Date,
        required: true,
        default: Date.now,
        immutable: true
    },
    updatedOn: Date
});

productSchema.plugin(paginate);

export default mongoose.model("Product", productSchema);