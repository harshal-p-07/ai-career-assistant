import mongoose from "mongoose";

const roadmapSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  targetCompany: { type: String, required: true },
  targetRole: { type: String },
  timeframeWeeks: { type: Number, default: 12 },
  currentLevel: { type: String },
  roadmap: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

export default mongoose.model("Roadmap", roadmapSchema);
