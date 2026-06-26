// routes/resume.js
import express from "express";
import multer from "multer";
import path from "path";
import { protect } from "../middleware/auth.js";
import {
  analyzeResumeController,
  getHistory,
  getAnalysis,
} from "../controllers/resumeController.js";

// Multer config — store temporarily, PDF only, max 5MB
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) =>
    cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() !== ".pdf") {
      return cb(new Error("Only PDF files are allowed."));
    }
    cb(null, true);
  },
});

const router = express.Router();

router.post("/analyze", protect, upload.single("resume"), analyzeResumeController);
router.get("/history", protect, getHistory);
router.get("/:id", protect, getAnalysis);

export default router;
