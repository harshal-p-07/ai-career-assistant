/// controllers/chatController.js
import { callAI } from "../services/aiHelper.js";
import ChatMemory from "../models/ChatMemory.js";
import Analysis from "../models/Analysis.js";

export async function sendMessage(req, res) {
  try {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ message: "Message required." });

    let memory = await ChatMemory.findOne({ userId: req.userId });

    if (!memory) {
      const latest = await Analysis.findOne({ userId: req.userId }).sort({ createdAt: -1 });
      const summary = latest
        ? `ATS Score: ${latest.result?.ats_score}/100, Level: ${latest.result?.experience_level}, Strengths: ${(latest.result?.strengths || []).join(", ")}, Missing Skills: ${(latest.result?.missing_skills || []).join(", ")}, Top Roles: ${(latest.result?.top_roles_matched || []).join(", ")}`
        : "No resume analyzed yet.";
      memory = await ChatMemory.create({ userId: req.userId, messages: [], resumeSummary: summary });
    }

    const systemPrompt = `You are CareerAI, a personal AI career coach.
User profile: ${memory.resumeSummary || "No resume yet."}
Give specific, actionable advice. Keep responses under 4 sentences unless asked for details.
Do not use bullet points or markdown. Write in plain conversational text.`;

    const recent = memory.messages.slice(-20).map((m) => ({ role: m.role, content: m.content }));

    const reply = await callAI([
      { role: "system", content: systemPrompt },
      ...recent,
      { role: "user", content: message },
    ], 0.7);

    memory.messages.push({ role: "user", content: message });
    memory.messages.push({ role: "assistant", content: reply });
    if (memory.messages.length > 100) memory.messages = memory.messages.slice(-100);
    await memory.save();

    res.json({ reply });
  } catch (e) {
    console.error("Chat error:", e.message);
    res.status(500).json({ message: "Chat failed.", error: e.message });
  }
}

export async function getChatHistory(req, res) {
  try {
    const m = await ChatMemory.findOne({ userId: req.userId });
    res.json({ messages: m?.messages.slice(-50) || [], resumeSummary: m?.resumeSummary || "" });
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
}

export async function clearChat(req, res) {
  try {
    await ChatMemory.findOneAndUpdate({ userId: req.userId }, { messages: [] });
    res.json({ message: "Cleared." });
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
}