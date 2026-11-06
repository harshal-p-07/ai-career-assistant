// ============================================================
//  controllers/interviewController.js
//  Orchestrates LangGraph Interview Agent (interviewAgentLG.js)
//  POST /api/interview/start  → Steps 1-2-3 (research+assess+question)
//  POST /api/interview/answer → Steps 4-5   (feedback+adapt) per turn
// ============================================================

import Interview from "../models/Interview.js";
import Analysis  from "../models/Analysis.js";
import Research  from "../models/Research.js";
import { startInterviewAgent, processAnswerAgent } from "../services/interviewAgentLG.js";
import { cleanForVoice } from "../services/aiHelper.js";

// ── POST /api/interview/start ──────────────────────────────────
export async function startInterview(req, res) {
  try {
    const {
      jobRole,
      company = "",
      analysisId,
      researchId,
      interviewType = "technical_behavioral",
      practiceMode = "standard",
      candidateLevel = "fresher",
      systemDesignMode = "ai_decide",
    } = req.body;
    if (!jobRole?.trim()) return res.status(400).json({ message: "Job role required." });

    // Load resume text
    let resumeText = "";
    const src = analysisId
      ? await Analysis.findOne({ _id: analysisId, userId: req.userId })
      : await Analysis.findOne({ userId: req.userId }).sort({ createdAt: -1 });
    if (src) resumeText = src.resumeText || "";

    // Agent 1 → Agent 2 handoff
    let existingPatterns = null;
    if (researchId) {
      const prev = await Research.findOne({ _id: researchId, userId: req.userId });
      if (prev?.report?.companyPatterns?.focus_topics?.length) {
        existingPatterns = prev.report.companyPatterns;
        console.log("🔗 LangGraph Interview: using Research Agent output (Step 1 skipped)");
      }
    }

    const targetCompany = company.trim() || jobRole.trim();

    // Run LangGraph Steps 1-2-3
    const result = await startInterviewAgent({
      jobRole,
      company: targetCompany,
      resumeText,
      existingPatterns,
      interviewType,
      practiceMode,
      candidateLevel,
      systemDesignMode,
    });

    // Save Interview document with agentState
    const interview = await Interview.create({
      userId:    req.userId,
      jobRole,
      company:   targetCompany,
      researchId: researchId || undefined,
      resumeText: resumeText.substring(0, 2000),
      messages: [{
        role:        "ai",
        content:     result.firstMessage,
        agentStep:   "step3_question",
        topicChosen: result.topicChosen,
      }],
      agentState: {
        companyPatterns:     result.companyPatterns,
        assessment:          result.assessment,
        scores:              [],
        questionCount:       result.questionCount,
        currentQuestion:     result.firstMessage,
        interviewType,
        practiceMode,
        candidateLevel,
        systemDesignMode,
        allowedTopics:       result.allowedTopics,
        excludedTopics:      result.excludedTopics,
        askedQuestions:      result.askedQuestions,
    

        weakAreasIdentified: result.assessment?.weak_areas  || [],
        strongAreas:         result.assessment?.strong_areas || [],
        readinessScore:      result.assessment?.readiness_score || 60,
        existingPatterns,
      },
    });

    res.json({
      interviewId: interview._id,
      message:     result.firstMessage,
      agentContext: {
        companyPatterns: result.companyPatterns,
        assessment:      result.assessment,
        topicChosen:     result.topicChosen,
      },
    });

  } catch (err) {
    console.error("Start interview error:", err.message);
    res.status(500).json({ message: "Failed to start interview.", error: err.message });
  }
}

// ── POST /api/interview/answer ─────────────────────────────────
export async function sendAnswer(req, res) {
  try {
    const { interviewId, answer } = req.body;
    if (!answer?.trim()) return res.status(400).json({ message: "Answer required." });

    const interview = await Interview.findOne({ _id: interviewId, userId: req.userId });
    if (!interview)                        return res.status(404).json({ message: "Interview not found." });
    if (interview.status === "completed")  return res.status(400).json({ message: "Interview already completed." });

    const state = interview.agentState;

    // Run LangGraph Steps 4-5
    const result = await processAnswerAgent({
      jobRole: interview.jobRole,
      company: interview.company,
      resumeText: interview.resumeText,
      companyPatterns: state.companyPatterns,
      assessment: state.assessment,
      currentQuestion: state.currentQuestion,
      currentAnswer: answer.trim(),
      questionCount: state.questionCount,
      scores: state.scores || [],
      existingPatterns: state.existingPatterns,
    
      interviewType: state.interviewType,
      practiceMode: state.practiceMode,
      candidateLevel: state.candidateLevel,
      systemDesignMode: state.systemDesignMode,
    });

    // Persist messages
    interview.messages.push({ role: "user", content: answer.trim() });
    interview.messages.push({
      role:                 "ai",
      content:              result.message,
      score:                result.score,
      feedback:             result.feedback,
      agentStep:            result.isComplete ? "complete" : "step5_adapt",
      topicChosen:          result.adaptDecision?.nextTopic || "",
      difficulty:           result.adaptDecision?.difficultyAdjustment || "",
      agentReasoning:       result.agentReasoning,
      specificMistake:      result.specificMistake,
    });

    // Update agentState for next turn
    if (!result.isComplete) {
      interview.agentState.scores        = result.updatedScores || [...state.scores, result.score];
      interview.agentState.questionCount = state.questionCount + 1;
      interview.agentState.currentQuestion = result.nextQuestion || result.message;
    }

    // Session complete
    if (result.isComplete) {
      interview.status       = "completed";
      interview.overallScore = result.overallScore;
      if (result.sessionReport?.nextSessionFocus) {
        interview.agentState.nextSessionFocus = result.sessionReport.nextSessionFocus;
      }
    }

    interview.markModified("agentState");
    await interview.save();

    res.json({
      message:              result.message,
      feedback:             result.feedback,
      score:                result.score,
      agentReasoning:       result.agentReasoning,
      specificMistake:      result.specificMistake,
      suggestedImprovement: result.suggestedImprovement,
      isComplete:           result.isComplete,
      overallScore:         result.overallScore,
      adaptDecision:        result.adaptDecision,
    });

  } catch (err) {
    console.error("Send answer error:", err.message);
    res.status(500).json({ message: "Failed to process answer.", error: err.message });
  }
}

// ── GET /api/interview ─────────────────────────────────────────
export async function getInterviews(req, res) {
  try {
    const data = await Interview.find({ userId: req.userId })
      .select("-messages -resumeText -agentState.companyPatterns")
      .sort({ createdAt: -1 })
      .limit(10);
    res.json(data);
  } catch { res.status(500).json({ message: "Server error" }); }
}

// ── GET /api/interview/:id ─────────────────────────────────────
export async function getInterview(req, res) {
  try {
    const data = await Interview.findOne({ _id: req.params.id, userId: req.userId });
    if (!data) return res.status(404).json({ message: "Not found." });
    res.json(data);
  } catch { res.status(500).json({ message: "Server error" }); }
}
