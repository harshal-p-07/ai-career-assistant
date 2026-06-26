import express from "express";
import { protect } from "../middleware/auth.js";
import { sendMessage, getChatHistory, clearChat } from "../controllers/chatController.js";
const router = express.Router();
router.post("/", protect, sendMessage);
router.get("/history", protect, getChatHistory);
router.delete("/clear", protect, clearChat);
export default router;
