import mongoose from "mongoose"

const caseSchema = new mongoose.Schema({
    caseId: {
        type: String,
        required: true,
        unique: true
    },

    title: {
        type: String,
        required: true,
        trim: true
    },

    description: {
        type: String,
        trim: true
    },

    status: {
        type: String,
        enum: ["active", "closed"],
        default: "active"
    }
}, {
    timestamps: true
});

const Case = mongoose.model("Case", caseSchema);
export default Case;