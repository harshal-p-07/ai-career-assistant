// controllers/resumeController.js
import fs from "fs";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { analyzeResume } from "../services/aiService.js";
import Analysis from "../models/Analysis.js";

export async function analyzeResumeController(req, res) {
  try {
    if (!req.file) return res.status(400).json({ message: "No PDF file uploaded." });

    // Extract text from PDF
    const dataBuffer = fs.readFileSync(req.file.path);
    const pdfData = await pdfParse(dataBuffer);
    const resumeText = pdfData.text;

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    if (!resumeText || resumeText.trim().length < 50)
      return res.status(400).json({ message: "Could not extract text from PDF. Make sure it's not a scanned image." });

    const jobRole = req.body.jobRole || "";

    // Call AI service
    const result = await analyzeResume(resumeText, jobRole);

    // Save to MongoDB
    const analysis = await Analysis.create({
      userId: req.userId,
      fileName: req.file.originalname,
      jobRole,
      resumeText: resumeText.substring(0, 3000), // save first 3000 chars
      result,
    });

    res.json({ analysisId: analysis._id, result });
  } catch (err) {
    console.error("Analysis error:", err.message);
    res.status(500).json({ message: "Analysis failed.", error: err.message });
  }
}

export async function getHistory(req, res) {
  try {
    const analyses = await Analysis.find({ userId: req.userId })
      .select("-resumeText")
      .sort({ createdAt: -1 })
      .limit(10);
    res.json(analyses);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
}

export async function getAnalysis(req, res) {
  try {
    const analysis = await Analysis.findOne({
      _id: req.params.id,
      userId: req.userId,
    });
    if (!analysis) return res.status(404).json({ message: "Analysis not found." });
    res.json(analysis);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
}
