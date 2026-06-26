import express from "express";
import { protect } from "../middleware/auth.js";
import { streamResearch, runResearch, getResearchHistory, getResearchById } from "../controllers/researchController.js";

const router = express.Router();

// SSE streaming — frontend uses fetch + ReadableStream
router.post("/stream", protect, streamResearch);

// Regular JSON fallback
router.post("/", protect, runResearch);

router.get("/history", protect, getResearchHistory);
router.get("/:id",    protect, getResearchById);

export default router;
