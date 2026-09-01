import mongoose from "mongoose";

const sanitizationSchema = new mongoose.Schema(
  {
    sanitizationId: {
      type: String,
      required: true,
      unique: true,
    },

    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Case",
      required: true,
    },

    target: {
      type: String,
      required: true,
    },

    targetType: {
      type: String,
      enum: ["file", "folder", "drive"],
      required: true,
    },

    method: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["queued", "processing", "completed", "failed"],
      default: "queued",
    },

    verification: {
      type: String,
      enum: ["passed", "failed", "inconclusive", "pending"],
      default: "pending",
    },

    startedAt: Date,

    completedAt: Date,
  },
  {
    timestamps: true,
  }
);

const Sanitization = mongoose.model(
  "Sanitization",
  sanitizationSchema
);

export default Sanitization;