import mongoose from "mongoose";

const recoverySchema = new mongoose.Schema(
  {
    recoveryId: {
      type: String,
      required: true,
      unique: true,
    },

    evidenceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Evidence",
      required: true,
    },

    status: {
      type: String,
      enum: ["queued", "processing", "completed", "failed"],
      default: "queued",
    },

    totalFilesDetected: {
      type: Number,
      default: 0,
    },

    filesRecovered: {
      type: Number,
      default: 0,
    },

    filesCarved: {
      type: Number,
      default: 0,
    },

    filesFailed: {
      type: Number,
      default: 0,
    },

    startedAt: {
      type: Date,
    },

    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

const Recovery = mongoose.model("Recovery", recoverySchema);

export default Recovery;