// ============================================================
//  controllers/interviewController.js
//  Agentic Interview — orchestrates interviewAgent.js steps
// ============================================================

import Interview from "../models/Interview.js";
import Analysis  from "../models/Analysis.js";
import Research  from "../models/Research.js";
import {
  stepResearch,
  stepAssess,
  stepGenerateFirstQuestion,
  stepFeedback,
  stepAdapt,
  generateSessionReport,
} from "../services/interviewAgent.js";
import { cleanForVoice } from "../services/aiHelper.js";

const MAX_QUESTIONS = 5;

// ── POST /api/interview/start ─────────────────────────────
// Runs Step 1 (Research) + Step 2 (Assess) + Step 3 (Q1)
export async function startInterview(req, res) {
  try {
    const { jobRole, company = "", analysisId, researchId } = req.body;
    if (!jobRole?.trim()) return res.status(400).json({ message: "Job role required." });

    // Load resume text if available
    let resumeText = "";
    const src = analysisId
      ? await Analysis.findOne({ _id: analysisId, userId: req.userId })
      : await Analysis.findOne({ userId: req.userId }).sort({ createdAt: -1 });
    if (src) resumeText = src.resumeText || "";

    const targetCompany = company.trim() || jobRole.trim();

    // ── Agent 1 → Agent 2 handoff ─────────────────────────
    // If user provides researchId, load the Deep Research Agent
    // output and pass companyPatterns directly into Step 1.
    let existingPatterns = null;
    if (researchId) {
      const prev = await Research.findOne({ _id: researchId, userId: req.userId });
      if (prev?.report?.companyPatterns?.focus_topics?.length) {
        existingPatterns = prev.report.companyPatterns;
        console.log("🔗 Interview Agent using Research Agent output — skipping Step 1 re-fetch");
      }
    }

    // ── STEP 1: Research company patterns ─────────────────
    const companyPatterns = await stepResearch(targetCompany, jobRole, existingPatterns);

    // ── STEP 2: Assess skill gaps from resume ─────────────
    const assessment = await stepAssess(companyPatterns, resumeText, jobRole);

    // ── STEP 3: Generate first adaptive question ──────────
    const q1 = await stepGenerateFirstQuestion(companyPatterns, assessment, jobRole, 1);
    const firstMessage = cleanForVoice(q1.question);

    // Save everything to DB
    const interview = await Interview.create({
      userId: req.userId,
      jobRole,
      company: targetCompany,
      resumeText: resumeText.substring(0, 2000),
      messages: [{
        role: "ai",
        content: firstMessage,
        agentStep: "step3_question",
        topicChosen: q1.topic_chosen,
        difficulty: q1.difficulty,
      }],
      agentState: {
        companyPatterns,
        assessment,
        scores: [],
        questionCount: 1,
        currentQuestion: firstMessage,
        weakAreasIdentified: assessment.weak_areas || [],
        strongAreas: assessment.strong_areas || [],
        readinessScore: assessment.readiness_score || 60,
      },
    });

    res.json({
      interviewId: interview._id,
      message: firstMessage,
      // Send agent context to frontend for display
      agentContext: {
        companyPatterns,
        assessment,
        topicChosen: q1.topic_chosen,
        difficulty: q1.difficulty,
      },
    });

  } catch (err) {
    console.error("Start interview error:", err.message);
    res.status(500).json({ message: "Failed to start interview.", error: err.message });
  }
}

// ── POST /api/interview/answer ────────────────────────────
// Runs Step 4 (Feedback) + Step 5 (Adapt) per turn
export async function sendAnswer(req, res) {
  try {
    const { interviewId, answer } = req.body;
    if (!answer?.trim()) return res.status(400).json({ message: "Answer required." });

    const interview = await Interview.findOne({ _id: interviewId, userId: req.userId });
    if (!interview) return res.status(404).json({ message: "Interview not found." });
    if (interview.status === "completed") return res.status(400).json({ message: "Interview already completed." });

    const state = interview.agentState;
    const currentQuestion = state.currentQuestion || "previous question";
    const history = interview.messages.map((m) => ({ role: m.role, content: m.content }));

    // ── STEP 4: Score + Feedback ───────────────────────────
    const feedback = await stepFeedback(currentQuestion, answer, interview.jobRole, history);

    // Save user answer + AI feedback
    interview.messages.push({ role: "user", content: answer });

    const qCount = state.questionCount || 1;
    const isLast = qCount >= MAX_QUESTIONS;

    // Build next response
    let nextMessage = "";
    let adaptResult = null;

    if (isLast) {
      // Session complete
      const report = await generateSessionReport(
        interview.jobRole, interview.company, state.assessment, interview.messages
      );
      nextMessage = cleanForVoice(
        `That wraps up our interview. You scored an average of ${report.overallScore} percent. ` +
        `Your strongest areas were ${report.strongAreas.slice(0, 2).join(" and ")}. ` +
        `For your next session, focus on ${report.nextSessionFocus.join(" and ")}.`
      );
      interview.status = "completed";
      interview.overallScore = report.overallScore;

      Object.assign(interview.agentState, {
        nextSessionFocus: report.nextSessionFocus,
      });

    } else {
      // ── STEP 5: Adaptive planning for next question ──────
      const updatedScores = [...(state.scores || []), feedback.score];
      adaptResult = await stepAdapt(
        updatedScores,
        state.weakAreasIdentified,
        state.companyPatterns,
        qCount,
        interview.jobRole
      );
      nextMessage = cleanForVoice(adaptResult.next_question);

      // Update agent state
      interview.agentState.scores = updatedScores;
      interview.agentState.questionCount = qCount + 1;
      interview.agentState.currentQuestion = nextMessage;
    }

    // Push AI response with full agent metadata
    interview.messages.push({
      role: "ai",
      content: nextMessage,
      score: feedback.score,
      feedback: cleanForVoice(feedback.feedback),
      agentStep: isLast ? "complete" : "step5_adapt",
      topicChosen: adaptResult?.next_topic || "",
      difficulty: adaptResult?.difficulty_adjustment || "",
      agentReasoning: cleanForVoice(feedback.agent_reasoning || ""),
      specificMistake: cleanForVoice(feedback.specific_mistake || ""),
    });

    interview.markModified("agentState");
    await interview.save();

    res.json({
      message: nextMessage,
      feedback: cleanForVoice(feedback.feedback),
      score: feedback.score,
      agentReasoning: cleanForVoice(feedback.agent_reasoning || ""),
      specificMistake: cleanForVoice(feedback.specific_mistake || ""),
      suggestedImprovement: cleanForVoice(feedback.suggested_improvement || ""),
      isComplete: isLast,
      overallScore: interview.overallScore,
      // Adaptive decision info — shown in UI
      adaptDecision: adaptResult ? {
        decision: adaptResult.decision,
        nextTopic: adaptResult.next_topic,
        difficultyAdjustment: adaptResult.difficulty_adjustment,
      } : null,
    });

  } catch (err) {
    console.error("Send answer error:", err.message);
    res.status(500).json({ message: "Failed to process answer.", error: err.message });
  }
}

// ── GET /api/interview ────────────────────────────────────
export async function getInterviews(req, res) {
  try {
    const data = await Interview.find({ userId: req.userId })
      .select("-messages -resumeText -agentState.companyPatterns")
      .sort({ createdAt: -1 })
      .limit(10);
    res.json(data);
  } catch { res.status(500).json({ message: "Server error" }); }
}

// ── GET /api/interview/:id ────────────────────────────────
export async function getInterview(req, res) {
  try {
    const data = await Interview.findOne({ _id: req.params.id, userId: req.userId });
    if (!data) return res.status(404).json({ message: "Not found." });
    res.json(data);
  } catch { res.status(500).json({ message: "Server error" }); }
}
