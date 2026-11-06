import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ["user", "assistant"], required: true },
  content: { type: String, required: true },
}, { timestamps: true });

const chatMemorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  messages: [messageSchema],
  resumeSummary: { type: String }, // stored summary of user's resume for context
  lastAnalysisId: { type: mongoose.Schema.Types.ObjectId, ref: "Analysis" },
}, { timestamps: true });

export default mongoose.model("ChatMemory", chatMemorySchema);
