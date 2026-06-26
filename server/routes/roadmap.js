import express from "express";
import { protect } from "../middleware/auth.js";
import { generateRoadmap, getRoadmaps, getRoadmap } from "../controllers/roadmapController.js";
const router = express.Router();
router.post("/generate", protect, generateRoadmap);
router.get("/", protect, getRoadmaps);
router.get("/:id", protect, getRoadmap);
export default router;
