import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
import authRoutes from "./routes/auth.js";
import resumeRoutes from "./routes/resume.js";
import researchRoutes from "./routes/research.js";
import interviewRoutes from "./routes/interview.js";
import roadmapRoutes from "./routes/roadmap.js";
import chatRoutes from "./routes/chat.js";

dotenv.config();
const app = express();

if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || 
        origin.includes('vercel.app') || 
        origin.includes('localhost')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/resume", resumeRoutes);
app.use("/api/research", researchRoutes);
app.use("/api/interview", interviewRoutes);
app.use("/api/roadmap", roadmapRoutes);
app.use("/api/chat", chatRoutes);

app.get("/", (req, res) => res.json({ message: "AI Career Assistant API ✅" }));

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    app.listen(process.env.PORT || 5000, () =>
      console.log(`✅ Server on port ${process.env.PORT || 5000}`)
    );
  })
  .catch((err) => console.error("❌ MongoDB failed:", err.message));
