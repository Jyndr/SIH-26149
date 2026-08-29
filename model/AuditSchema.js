import mongoose from "mongoose";

const auditSchema = new mongoose.Schema(
  {
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Case",
      required: true,
    },

    action: {
      type: String,
      required: true,
    },

    target: {
      type: String,
    },

    details: {
      type: String,
    },

    timestamp: {
      type: Date,
      default: Date.now,
    },
  }
);

const Audit = mongoose.model("Audit", auditSchema);

export default Audit;