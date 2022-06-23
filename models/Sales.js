import mongoose from "mongoose";

const daysSubSchema = new mongoose.Schema({
    totalSold: {}
});

const monthSubSchema = new mongoose.Schema({
    index: {
        type: Number,
        required: true,
        immutable: true,
        enum: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    }
});

const salesSchema = new mongoose.Schema({
    year: {
        type: String,
        index: true,
        required: true,
        immutable: true
    },
    months: {
        type: monthSubSchema,
        required: true,
        immutable: true
    }
});

export default mongoose.model("Address", salesSchema);