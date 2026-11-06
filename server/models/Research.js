import mongoose from "mongoose";

const researchSchema = new mongoose.Schema(
  {
    userId:   { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    query:    { type: String, required: true },
    type:     { type: String, default: "Company Research" },
    // Full agent output — includes insights, stats, companyPatterns, agentTrace
    report:   { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

export default mongoose.model("Research", researchSchema);
