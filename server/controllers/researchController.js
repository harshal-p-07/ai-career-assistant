// ============================================================
//  controllers/researchController.js
//
//  POST /api/research/stream  — SSE: streams live agent events
//  POST /api/research         — regular JSON (fallback)
//  GET  /api/research/history
//  GET  /api/research/:id
// ============================================================

import { runResearchAgent } from "../services/researchAgent.js";
import Research from "../models/Research.js";


export async function streamResearch(req, res) {
  const { query, type } = req.body;

  if (!query?.trim() || query.trim().length < 2) {
    return res.status(400).json({ message: "Please provide a search query." });
  }

  
  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection",    "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();


  const emit = (data) => {
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (_) { /* client disconnected */ }
  };

  try {
    const output = await runResearchAgent(query.trim(), type || "Company Research", emit);

   
    const saved = await Research.create({
      userId: req.userId,
      query:  query.trim(),
      type:   type || "Company Research",
      report: output,
    });

  
    emit({ phase: "saved", researchId: saved._id.toString() });

  } catch (err) {
    emit({ phase: "error", message: err.message || "Research failed." });
  } finally {
    res.end();
  }
}


export async function runResearch(req, res) {
  try {
    const { query, type } = req.body;
    if (!query?.trim()) return res.status(400).json({ message: "Query required." });

    const output = await runResearchAgent(query.trim(), type || "Company Research");
    const saved  = await Research.create({
      userId: req.userId,
      query:  query.trim(),
      type:   type || "Company Research",
      report: output,
    });

    res.json({ researchId: saved._id, data: output });

  } catch (err) {
    console.error("Research error:", err.message);
    res.status(500).json({ message: "Research failed.", error: err.message });
  }
}


export async function getResearchHistory(req, res) {
  try {
    const history = await Research.find({ userId: req.userId })
      .select("query type createdAt report.stats report.title")
      .sort({ createdAt: -1 })
      .limit(10);
    res.json(history);
  } catch { res.status(500).json({ message: "Server error" }); }
}


export async function getResearchById(req, res) {
  try {
    const doc = await Research.findOne({ _id: req.params.id, userId: req.userId });
    if (!doc) return res.status(404).json({ message: "Not found." });
    res.json(doc);
  } catch { res.status(500).json({ message: "Server error" }); }
}
