import { callAI, parseJSON } from "../services/aiHelper.js";
import Roadmap from "../models/Roadmap.js";
import Analysis from "../models/Analysis.js";

export async function generateRoadmap(req, res) {
  try {
    const { targetCompany, targetRole, timeframeWeeks, currentLevel } = req.body;
    if (!targetCompany) return res.status(400).json({ message: "Target company is required." });

    // Get user's DSA level from latest analysis if available
    const latest = await Analysis.findOne({ userId: req.userId }).sort({ createdAt: -1 });
    const resumeContext = latest ? `Candidate's experience level: ${latest.result?.experience_level || "Fresher"}. Skills: ${(latest.result?.keywords_found || []).join(", ")}` : "";

    const prompt = `You are an expert DSA coach specializing in placement preparation for Indian tech companies.

Generate a detailed DSA roadmap for:
- Target Company: ${targetCompany}
- Target Role: ${targetRole || "Software Engineer"}
- Timeframe: ${timeframeWeeks || 12} weeks
- Current Level: ${currentLevel || "Beginner"}
${resumeContext ? `- ${resumeContext}` : ""}

Return ONLY valid JSON:
{
  "title": "<Roadmap title>",
  "target_company": "${targetCompany}",
  "total_weeks": ${timeframeWeeks || 12},
  "overview": "<2-3 sentence overview of the preparation strategy>",
  "company_pattern": {
    "difficulty": "<Easy/Medium/Hard mix e.g. 60% Easy, 30% Medium, 10% Hard>",
    "focus_areas": ["<area 1>", "<area 2>", "<area 3>"],
    "interview_rounds": ["<round 1>", "<round 2>", "<round 3>"]
  },
  "weekly_plan": [
    {
      "week": 1,
      "theme": "<week theme>",
      "topics": ["<topic 1>", "<topic 2>"],
      "problems_count": <number>,
      "key_problems": ["<problem name>", "<problem name>"],
      "goal": "<what to achieve this week>"
    }
  ],
  "topic_priority": [
    { "topic": "<DSA topic>", "priority": "<High|Medium|Low>", "problems_recommended": <number> }
  ],
  "daily_schedule": {
    "weekday": "<daily plan on weekdays>",
    "weekend": "<weekend plan>"
  },
  "resources": [
    { "name": "<resource>", "type": "<Platform|Book|YouTube>", "url": "<url or empty>" }
  ],
  "tips": ["<company specific tip 1>", "<tip 2>", "<tip 3>"]
}`;

    const raw = await callAI([{ role: "user", content: prompt }]);
    const roadmapData = parseJSON(raw);

    const saved = await Roadmap.create({
      userId: req.userId,
      targetCompany,
      targetRole: targetRole || "Software Engineer",
      timeframeWeeks: timeframeWeeks || 12,
      currentLevel: currentLevel || "Beginner",
      roadmap: roadmapData,
    });

    res.json({ roadmapId: saved._id, roadmap: roadmapData });
  } catch (err) {
    console.error("Roadmap error:", err.message);
    res.status(500).json({ message: "Failed to generate roadmap.", error: err.message });
  }
}

export async function getRoadmaps(req, res) {
  try {
    const roadmaps = await Roadmap.find({ userId: req.userId })
      .select("-roadmap.weekly_plan").sort({ createdAt: -1 }).limit(5);
    res.json(roadmaps);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
}

export async function getRoadmap(req, res) {
  try {
    const roadmap = await Roadmap.findOne({ _id: req.params.id, userId: req.userId });
    if (!roadmap) return res.status(404).json({ message: "Not found." });
    res.json(roadmap);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
}
