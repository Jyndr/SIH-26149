import mongoose from "mongoose";

const evidenceSchema = new mongoose.Schema(
  {
    evidenceId: {
      type: String,
      required: true,
      unique: true,
    },

    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Case",
      required: true,
    },

    filename: {
      type: String,
      required: true,
      trim: true,
    },

    size: {
      type: Number,
      required: true,
    },

    sha256: {
      type: String,
      required: true,
    },

    storagePath: {
      type: String,
      required: true,
    },

    analysisStatus: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

const Evidence = mongoose.model("Evidence", evidenceSchema);

export default Evidence;