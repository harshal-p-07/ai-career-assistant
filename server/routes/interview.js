import express from "express";
import { protect } from "../middleware/auth.js";
import { startInterview, sendAnswer, getInterviews, getInterview } from "../controllers/interviewController.js";
const router = express.Router();
router.post("/start", protect, startInterview);
router.post("/answer", protect, sendAnswer);
router.get("/", protect, getInterviews);
router.get("/:id", protect, getInterview);
export default router;
