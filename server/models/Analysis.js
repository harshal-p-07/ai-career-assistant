// models/Analysis.js
import mongoose from "mongoose";

const analysisSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    fileName: { type: String },
    jobRole: { type: String, default: "" },
    resumeText: { type: String },
    result: {
      ats_score: Number,
      overall_summary: String,
      strengths: [String],
      missing_skills: [String],
      improvements: [{ section: String, issue: String, fix: String }],
      keywords_found: [String],
      keywords_missing: [String],
      experience_level: String,
      top_roles_matched: [String],
      action_items: [String],
    },
  },
  { timestamps: true }
);

export default mongoose.model("Analysis", analysisSchema);
