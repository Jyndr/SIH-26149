import mongoose from "mongoose";

const recoveryResultSchema = new mongoose.Schema(
  {
    recoveryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Recovery",
      required: true,
    },

    filename: {
      type: String,
      required: true,
      trim: true,
    },

    fileType: {
      type: String,
      required: true,
    },

    size: {
      type: Number,
      default: 0,
    },

    recoveryMethod: {
      type: String,
      enum: ["filesystem", "carving"],
      required: true,
    },

    status: {
      type: String,
      enum: ["valid", "partial", "corrupted", "failed"],
      required: true,
    },

    confidence: {
      type: Number,
      min: 0,
      max: 100,
    },

    sha256: {
      type: String,
    },

    storagePath: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const RecoveryResult = mongoose.model(
  "RecoveryResult",
  recoveryResultSchema
);

export default RecoveryResult;