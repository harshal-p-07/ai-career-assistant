import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  role:     { type: String, enum: ["ai", "user"], required: true },
  content:  { type: String, required: true },
  score:    { type: Number },
  feedback: { type: String },
  // Agent metadata — stored per AI message for transparency
  agentStep:    { type: String },   // which step produced this message
  topicChosen:  { type: String },   // what topic the agent decided to test
  difficulty:   { type: String },   // Easy/Medium/Hard
  agentReasoning: { type: String }, // why the agent asked this / gave this score
  specificMistake: { type: String }, // specific mistake if any
}, { timestamps: true });

const interviewSchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  analysisId: { type: mongoose.Schema.Types.ObjectId, ref: "Analysis" },
  jobRole:    { type: String, required: true },
  company:    { type: String, default: "" },
  resumeText: { type: String },
  messages:   [messageSchema],
  status:     { type: String, enum: ["active", "completed"], default: "active" },
  overallScore: { type: Number },

  // Agent state — persisted between answer turns
  agentState: {
    companyPatterns: { type: mongoose.Schema.Types.Mixed },  // Step 1 output
    assessment:      { type: mongoose.Schema.Types.Mixed },  // Step 2 output
    scores:          [Number],                               // running score list
    questionCount:   { type: Number, default: 0 },
    currentQuestion: { type: String },                       // last question asked
    weakAreasIdentified: [String],
    strongAreas:         [String],
    readinessScore:      { type: Number },
    nextSessionFocus:    [String],
  },
}, { timestamps: true });

export default mongoose.model("Interview", interviewSchema);
