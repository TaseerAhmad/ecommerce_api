import mongoose from "mongoose";

const regionSchema = new mongoose.Schema({
    name: {
        type: String,
        index: true,
        required: true
    },
    geo: {
        lat: {
            type: String,
            required: true
        },
        lon: {
            type: String,
            required: true
        }
    },
    isActive: {
        type: Boolean,
        default: false
    },
    activatedOn: Date,
    disabledOn: Date,
    createdOn: Date
});

export default mongoose.model("Region", regionSchema);