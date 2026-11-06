// ============================================================
//  services/interviewAgent.js
//  5-Step Agentic Interview Preparation System
//
//  Step 1 — Research:   fetch company interview patterns (Serper + AI)
//  Step 2 — Assess:     compare resume strengths vs company needs → skill gaps
//  Step 3 — Generate:   pick adaptive first question targeting weak areas
//  Step 4 — Feedback:   score answer, identify mistakes, show reasoning
//  Step 5 — Adapt:      adjust next question based on performance history
//
//  The MODEL decides what question to ask next based on weak areas.
//  The MODEL decides when to go harder/easier based on scores.
//  Your JS code only orchestrates — the intelligence is in the AI.
// ============================================================

import { AI_CONFIG } from "../config/ai.config.js";
import {
  callAgentPlan,
  callAgentAssess,
  callAgentQuestion,
  callAgentFeedback,
  callAgentAdapt,
  parseJSON,
  cleanForVoice,
} from "./aiHelper.js";

// ── Serper web search ──────────────────────────────────────
async function webSearch(query) {
  const apiKey = AI_CONFIG.serper.apiKey();
  if (!apiKey) {
    console.log("⚠ No SERPER_API_KEY — skipping web search, using AI knowledge only");
    return null;
  }
  try {
    const res = await fetch(AI_CONFIG.serper.endpoint, {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, num: AI_CONFIG.serper.resultsPerQuery }),
    });
    const data = await res.json();
    return (data.organic || [])
      .slice(0, 5)
      .map((r) => `• ${r.title}: ${r.snippet}`)
      .join("\n") || null;
  } catch (err) {
    console.warn("Serper error:", err.message);
    return null;
  }
}

// ── STEP 1: Research ─────────────────────────────────────
// If the user already ran the Deep Research Agent on this company,
// pass existingPatterns (companyPatterns from that output) and this
// step is skipped — Agent 1 output flows directly into Agent 2.
export async function stepResearch(company, role, existingPatterns = null) {
  if (existingPatterns?.focus_topics?.length) {
    console.log(`\n🔗 STEP 1: Using Research Agent output for "${company}" (skipping re-fetch)`);
    return existingPatterns;
  }
  console.log(`\n🔍 STEP 1: Researching ${company} interview patterns...`);

  // Parallel searches — agent decides what's worth searching
  const [process, techStack, questions] = await Promise.all([
    webSearch(`${company} software engineer interview process 2024 2025`),
    webSearch(`${company} tech stack engineering team`),
    webSearch(`${company} ${role} interview questions coding round`),
  ]);

  const searchContext = [process, techStack, questions].filter(Boolean).join("\n\n---\n\n")
    || "No web data available — use training knowledge.";

  const prompt = `You are analyzing interview data for a job seeker.
Company: ${company}, Role: ${role}

Web research data:
${searchContext}

Based on this, extract the interview patterns. Return ONLY valid JSON:
{
  "interview_rounds": ["round 1 description", "round 2 description"],
  "focus_topics": ["topic1", "topic2", "topic3", "topic4"],
  "difficulty_level": "Easy|Medium|Hard",
  "commonly_asked": ["question type 1", "question type 2", "question type 3"],
  "key_skills_needed": ["skill1", "skill2", "skill3", "skill4"],
  "company_summary": "2 sentence overview of what this company looks for"
}`;

  const raw = await callAgentPlan([{ role: "user", content: prompt }]);
  const parsed = parseJSON(raw);

  if (!parsed) {
    console.warn("Step 1 JSON parse failed — using fallback");
    return {
      interview_rounds: ["Online Assessment", "Technical Round", "HR Round"],
      focus_topics: ["DSA", "System Design", "Problem Solving"],
      difficulty_level: "Medium",
      commonly_asked: ["Array/String problems", "OOP concepts", "Projects discussion"],
      key_skills_needed: ["DSA", "Java/Python", "Communication"],
      company_summary: `${company} typically tests DSA fundamentals and project knowledge.`,
    };
  }

  console.log(`✅ STEP 1 done — found ${parsed.focus_topics?.length || 0} focus topics`);
  return parsed;
}

// ── STEP 2: Skill Assessment ──────────────────────────────
// AI compares resume strengths against company requirements,
// produces a ranked list of weak areas to target.
export async function stepAssess(companyPatterns, resumeText, role) {
  console.log(`\n📊 STEP 2: Assessing skill gaps...`);

  const prompt = `You are a career coach assessing a candidate's readiness.

Target Role: ${role}
Company Interview Focus: ${JSON.stringify(companyPatterns)}

Candidate Resume Summary:
${resumeText ? resumeText.substring(0, 1500) : "No resume provided — assess for general readiness"}

Identify skill gaps and assess readiness. Return ONLY valid JSON:
{
  "strong_areas": ["area1", "area2"],
  "weak_areas": ["area1", "area2", "area3"],
  "gap_analysis": "2 sentence analysis of biggest gaps",
  "recommended_focus": ["topic to focus most", "topic 2", "topic 3"],
  "readiness_score": 65,
  "interview_strategy": "one sentence advice for this specific company"
}`;

  const raw = await callAgentAssess([{ role: "user", content: prompt }]);
  const parsed = parseJSON(raw);

  if (!parsed) {
    return {
      strong_areas: ["Programming basics", "Problem solving"],
      weak_areas: ["System Design", "Advanced DSA", "Communication"],
      gap_analysis: "Candidate needs to strengthen DSA and system design skills.",
      recommended_focus: ["DSA", "System Design", "Projects"],
      readiness_score: 60,
      interview_strategy: `Focus on ${companyPatterns.focus_topics?.[0] || "DSA"} to match company expectations.`,
    };
  }

  console.log(`✅ STEP 2 done — readiness score: ${parsed.readiness_score}%`);
  return parsed;
}

// ── STEP 3: Generate First Question ──────────────────────
// AI autonomously decides what to ask based on weak areas + company patterns.
// This is where the agentic decision-making happens for question selection.
export async function stepGenerateFirstQuestion(companyPatterns, assessment, role, questionCount) {
  console.log(`\n❓ STEP 3: Generating adaptive question ${questionCount}...`);

  const prompt = `You are a technical interviewer for ${role}.

Company Focus Areas: ${companyPatterns.focus_topics?.join(", ")}
Candidate Weak Areas: ${assessment.weak_areas?.join(", ")}
Recommended Focus: ${assessment.recommended_focus?.join(", ")}
Question Number: ${questionCount} of 5

Based on the weak areas and company focus, pick the BEST topic to test.
Start with a relevant greeting for question 1, or transition naturally for later questions.

Rules:
- Target weak areas but don't make it impossible
- Mix topics across 5 questions for full coverage  
- Plain English, no markdown, no bullet points
- Speak as a human interviewer would out loud

Return ONLY valid JSON:
{
  "topic_chosen": "why you chose this topic",
  "difficulty": "Easy|Medium|Hard",
  "question": "the actual interview question in plain conversational text"
}`;

  const raw = await callAgentQuestion([{ role: "user", content: prompt }]);
  const parsed = parseJSON(raw);

  if (!parsed) {
    const topics = assessment.weak_areas || ["DSA"];
    const topic = topics[(questionCount - 1) % topics.length];
    return {
      topic_chosen: topic,
      difficulty: "Medium",
      question: questionCount === 1
        ? `Welcome! Let's start. Can you explain your experience with ${topic}?`
        : `Now let's talk about ${topic}. Can you explain how you'd approach a common problem in this area?`,
    };
  }

  console.log(`✅ STEP 3 done — chosen topic: ${parsed.topic_chosen}`);
  return parsed;
}

// ── STEP 4: Score + Feedback ──────────────────────────────
// AI scores the answer, identifies specific mistakes, and explains reasoning.
export async function stepFeedback(question, answer, role, history) {
  console.log(`\n📝 STEP 4: Scoring answer...`);

  const historyText = history
    .slice(-4) // last 2 Q&A pairs
    .map((m) => `${m.role === "ai" ? "Interviewer" : "Candidate"}: ${m.content}`)
    .join("\n");

  const prompt = `You are evaluating a candidate's interview answer.

Role being interviewed for: ${role}
Recent conversation:
${historyText}

Current Question: ${question}
Candidate Answer: ${answer}

Evaluate this answer rigorously. Return ONLY valid JSON:
{
  "score": 7,
  "feedback": "one sentence plain text feedback — what was good or bad",
  "specific_mistake": "if any mistake, state it clearly. Empty string if none",
  "agent_reasoning": "one sentence explaining why you gave this score",
  "suggested_improvement": "one specific thing they could add to improve"
}`;

  const raw = await callAgentFeedback([{ role: "user", content: prompt }]);
  const parsed = parseJSON(raw);

  if (!parsed) {
    return {
      score: 7,
      feedback: "Good attempt. Keep practicing.",
      specific_mistake: "",
      agent_reasoning: "Answer covered the basics.",
      suggested_improvement: "Add more technical depth.",
    };
  }

  console.log(`✅ STEP 4 done — score: ${parsed.score}/10`);
  return parsed;
}

// ── STEP 5: Adaptive Planning ─────────────────────────────
// AI looks at all scores so far and DECIDES what to ask next.
// If struggling → easier question on same topic.
// If doing well → harder question on a new weak area.
// This feedback loop is the core of the agentic behavior.
export async function stepAdapt(scores, weakAreas, companyPatterns, questionsDone, role) {
  console.log(`\n🔄 STEP 5: Adaptive planning for next question...`);

  const avgScore = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : 5;
  const lastScore = scores[scores.length - 1] || 5;

  const prompt = `You are planning the next interview question adaptively.

Role: ${role}
Performance so far: avg=${avgScore}/10, last=${lastScore}/10
Weak areas identified: ${weakAreas?.join(", ")}
Company focus topics: ${companyPatterns.focus_topics?.join(", ")}
Questions completed: ${questionsDone}

Decide the next question strategy. Return ONLY valid JSON:
{
  "decision": "why you chose this direction based on performance",
  "next_topic": "the topic to test next",
  "difficulty_adjustment": "Easier|Same|Harder",
  "next_question": "the actual question in plain conversational text — no markdown"
}`;

  const raw = await callAgentAdapt([{ role: "user", content: prompt }]);
  const parsed = parseJSON(raw);

  if (!parsed) {
    const topic = weakAreas?.[(questionsDone - 1) % (weakAreas?.length || 1)] || "problem solving";
    return {
      decision: `Continuing with ${avgScore >= 7 ? "harder" : "similar"} questions`,
      next_topic: topic,
      difficulty_adjustment: avgScore >= 7 ? "Harder" : avgScore < 5 ? "Easier" : "Same",
      next_question: `Let's try another question on ${topic}. Can you walk me through your approach?`,
    };
  }

  console.log(`✅ STEP 5 done — adjustment: ${parsed.difficulty_adjustment} → ${parsed.next_topic}`);
  return parsed;
}

// ── Final Session Report ──────────────────────────────────
export async function generateSessionReport(jobRole, company, assessment, messages) {
  const scores = messages.filter((m) => m.score != null).map((m) => m.score);
  const avgScore = scores.length
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10)
    : 60;

  return {
    overallScore: avgScore,
    weakAreasIdentified: assessment.weak_areas || [],
    strongAreas: assessment.strong_areas || [],
    readinessScore: assessment.readiness_score || avgScore,
    nextSessionFocus: assessment.recommended_focus?.slice(0, 2) || [],
    interviewStrategy: assessment.interview_strategy || "",
  };
}
