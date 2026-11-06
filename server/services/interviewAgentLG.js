// services/interviewAgentLG.js
// Interview Prep Agent — LangGraph JS
// Start: research → assess → question
// Answer: feedback → adapt → [report|end]

import { StateGraph, Annotation, END, START } from "@langchain/langgraph";
import {
  callAgentPlan,
  callAgentAssess,
  callAgentQuestion,
  callAgentFeedback,
  callAgentAdapt,
  parseJSON,
  cleanForVoice,
} from "./aiHelper.js";

const MAX_QUESTIONS = 5;
const MAX_ATTEMPTS_PER_TOPIC = 2;

const TOPICS = {
  dsa_coding: [
    "Arrays",
    "Strings",
    "Linked Lists",
    "Stacks",
    "Queues",
    "Hashing",
    "Trees",
    "Graphs",
    "Sorting",
    "Searching",
    "Recursion",
    "Greedy",
    "Dynamic Programming",
  ],

  system_design: [
    "API Design",
    "Database Design",
    "Caching",
    "Load Balancing",
    "Scalability",
    "Sharding",
    "Replication",
    "Message Queues",
    "Distributed Systems",
    "URL Shortener",
    "Notification System",
  ],

  technical_behavioral: [
    "Java",
    "OOP",
    "DBMS",
    "Operating Systems",
    "Networking",
    "Projects",
    "Behavioral",
  ],

  full_company_sim: [
    "DSA",
    "Coding",
    "OOP",
    "DBMS",
    "Projects",
    "Behavioral",
    "System Design",
    "HR",
  ],
};

function getInterviewTopics(interviewType) {
  return TOPICS[interviewType] || TOPICS.technical_behavioral;
}

function canonicalTopic(topic, allowedTopics) {
  if (!topic) return null;
  const value = String(topic).trim().toLowerCase();
  return allowedTopics.find((t) => t.toLowerCase() === value) || null;
}

const InterviewState = Annotation.Root({
  // Config
  jobRole:          Annotation({ reducer: (_, b) => b }),
  company:          Annotation({ reducer: (_, b) => b, default: () => "" }),
  resumeText:       Annotation({ reducer: (_, b) => b, default: () => "" }),
  existingPatterns: Annotation({ reducer: (_, b) => b, default: () => null }),
  graphMode:        Annotation({ reducer: (_, b) => b, default: () => "start" }),
  interviewType:    Annotation({ reducer: (_, b) => b, default: () => "technical_behavioral" }),
  practiceMode:     Annotation({ reducer: (_, b) => b, default: () => "standard" }),
  candidateLevel:   Annotation({ reducer: (_, b) => b, default: () => "fresher" }),
  systemDesignMode: Annotation({ reducer: (_, b) => b, default: () => "ai_decide" }),
  allowedTopics:    Annotation({ reducer: (_, b) => b, default: () => [] }),
  excludedTopics:   Annotation({ reducer: (_, b) => b, default: () => [] }),

  // Step outputs
  companyPatterns:  Annotation({ reducer: (_, b) => b, default: () => null }),
  assessment:       Annotation({ reducer: (_, b) => b, default: () => null }),
  firstQuestion:    Annotation({ reducer: (_, b) => b, default: () => "" }),
  topicChosen:      Annotation({ reducer: (_, b) => b, default: () => "" }),

  // Persistent interview state
  currentQuestion:  Annotation({ reducer: (_, b) => b, default: () => "" }),
  currentAnswer:    Annotation({ reducer: (_, b) => b, default: () => "" }),
  questionCount:    Annotation({ reducer: (_, b) => b, default: () => 0 }),
  scores:           Annotation({ reducer: (a, b) => [...a, ...b], default: () => [] }),
  topicAttempts:    Annotation({ reducer: (_, b) => b, default: () => ({}) }),
  currentTopic:     Annotation({ reducer: (_, b) => b, default: () => "" }),
  topicsCovered:    Annotation({ reducer: (_, b) => b, default: () => [] }),
  questionsPerTopic: Annotation({ reducer: (_, b) => b, default: () => 0 }),

  askedQuestions: Annotation({
    reducer: (_, b) => b,
    default: () => [],
  }),

  feedbackResult:   Annotation({ reducer: (_, b) => b, default: () => null }),
  adaptResult:      Annotation({ reducer: (_, b) => b, default: () => null }),
  sessionReport:    Annotation({ reducer: (_, b) => b, default: () => null }),
});

async function webSearch(query) {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, num: 5 }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.organic || []).slice(0, 5)
      .map((r) => `• ${r.title}: ${r.snippet}`).join("\n") || null;
  } catch { return null; }
}

async function researchNode(state) {
  const { company, jobRole, existingPatterns } = state;
  if (existingPatterns?.focus_topics?.length) {
    console.log("[LG Interview] STEP 1: Using Agent 1 output");
    return { companyPatterns: existingPatterns };
  }

  const target = company || jobRole;
  const [p1, p2, p3] = await Promise.all([
    webSearch(`${target} software engineer interview process 2025`),
    webSearch(`${target} tech stack engineering team`),
    webSearch(`${target} ${jobRole} interview questions`),
  ]);
  const ctx = [p1, p2, p3].filter(Boolean).join("\n\n---\n\n") || "Use AI training knowledge.";

  const prompt = `Extract interview patterns for "${target}", role: ${jobRole}.
Web data:
${ctx}

Return ONLY valid JSON:
{
  "interview_rounds": ["round 1","round 2","round 3"],
  "focus_topics": ["topic 1","topic 2","topic 3","topic 4"],
  "difficulty_level": "Easy|Medium|Hard",
  "commonly_asked": ["type 1","type 2","type 3"],
  "key_skills_needed": ["skill 1","skill 2","skill 3","skill 4"],
  "company_summary": "2 sentence overview"
}`;

  let patterns = null;
  try {
    patterns = parseJSON(await callAgentPlan([{ role: "user", content: prompt }]));
  } catch (e) { console.warn("Research node failed:", e.message); }

  return {
    companyPatterns: patterns || {
      interview_rounds: ["Online Assessment", "Technical Round", "HR Round"],
      focus_topics: ["DSA", "Problem Solving", "OOP", "DBMS"],
      difficulty_level: "Medium",
      commonly_asked: ["Array/String", "OOP concepts", "Project discussion"],
      key_skills_needed: ["DSA", "Java/Python", "Communication"],
      company_summary: `${target} tests DSA fundamentals and project knowledge.`,
    },
  };
}

async function assessNode(state) {
  const { jobRole, resumeText, companyPatterns } = state;
  const prompt = `You are a career coach assessing candidate readiness.

Role: ${jobRole}
Company Focus: ${JSON.stringify(companyPatterns)}

Resume:
${resumeText ? resumeText.substring(0, 1500) : "No resume — assess for general readiness"}

Return ONLY valid JSON:
{
  "strong_areas": ["area 1","area 2"],
  "weak_areas": ["area 1","area 2","area 3"],
  "gap_analysis": "2 sentence analysis",
  "recommended_focus": ["topic 1","topic 2","topic 3"],
  "readiness_score": 65,
  "interview_strategy": "one sentence advice"
}`;

  let assessment = null;
  try {
    assessment = parseJSON(await callAgentAssess([{ role: "user", content: prompt }]));
  } catch (e) { console.warn("Assess node failed:", e.message); }

  return {
    assessment: assessment || {
      strong_areas: ["Programming basics", "Problem solving"],
      weak_areas: ["System Design", "Advanced DSA"],
      gap_analysis: "Candidate needs to strengthen system design and advanced DSA skills.",
      recommended_focus: ["DSA", "System Design", "Projects"],
      readiness_score: 60,
      interview_strategy: "Focus on fundamentals and practice coding daily.",
    },
  };
}

async function questionNode(state) {
  const {
    jobRole,
    companyPatterns,
    assessment,
    questionCount,
    interviewType,
    candidateLevel,
    allowedTopics,
    excludedTopics = [],
    askedQuestions = [],
  } = state;

  const topics = (
    allowedTopics.length
      ? allowedTopics
      : getInterviewTopics(interviewType)
  ).filter(
    topic => !excludedTopics.includes(topic)
  );

 
  


  const fallback = topics[questionCount % topics.length];

  const prompt = `You are a technical interviewer for ${jobRole}.

Interview type: ${interviewType}
Candidate level: ${candidateLevel}
ALLOWED TOPICS: ${topics.join(", ")}

You MUST select topic_chosen from ALLOWED TOPICS.
Interview type is the primary constraint.
- dsa_coding: ONLY DSA/coding.
- system_design: ONLY System Design.
- technical_behavioral: ONLY technical fundamentals, projects, or behavioral.
- full_company_sim: follow the configured company simulation.

Company focus: ${companyPatterns.focus_topics?.join(", ") || "None"}
Candidate weak areas: ${assessment.weak_areas?.join(", ") || "None"}
Question number: ${questionCount + 1} of ${MAX_QUESTIONS}

Rules:
- Plain English, no markdown, no bullets.
- Sound like a real interviewer.
- Never choose a topic outside ALLOWED TOPICS.

Return ONLY valid JSON:
{
  "topic_chosen": "one allowed topic",
  "difficulty": "Easy|Medium|Hard",
  "question": "actual interview question"
}`;

  let q = null;
  try { q = parseJSON(await callAgentQuestion([{ role: "user", content: prompt }])); }
  catch (e) { console.warn("Question node failed:", e.message); }

  const topic = canonicalTopic(q?.topic_chosen, topics) || fallback;
  const question = q?.question?.trim() ||
    (questionCount === 0
      ? `Welcome! Let's get started. Can you explain an important concept in ${topic}?`
      : `Let's discuss ${topic}. How would you approach a practical problem in this area?`);
  const cleanQ = cleanForVoice(question);

  const attempts = { ...(state.topicAttempts || {}) };
  attempts[topic] = (attempts[topic] || 0) + 1;
  const covered = [...new Set([...(state.topicsCovered || []), topic])];

  return {
    firstQuestion: cleanQ,
    currentQuestion: cleanQ,
    topicChosen: topic,
    currentTopic: topic,
    topicAttempts: attempts,
    topicsCovered: covered,
    questionsPerTopic: attempts[topic],
    questionCount: questionCount + 1,
  };
}

async function feedbackNode(state) {
  const { currentQuestion, currentAnswer, jobRole } = state;
  const prompt = `Evaluate this interview answer.

Role: ${jobRole}
Question: ${currentQuestion}
Answer: ${currentAnswer}

Return ONLY valid JSON:
{
  "score": 7,
  "feedback": "one sentence — what was good or lacking",
  "specific_mistake": "exact mistake or empty string",
  "agent_reasoning": "one sentence why this score",
  "suggested_improvement": "one concrete improvement"
}`;

  let feedback = null;
  try { feedback = parseJSON(await callAgentFeedback([{ role: "user", content: prompt }])); }
  catch (e) { console.warn("Feedback node failed:", e.message); }

  feedback = feedback || {
    score: 7,
    feedback: "Good attempt.",
    specific_mistake: "",
    agent_reasoning: "Covered the basics.",
    suggested_improvement: "Add more detail.",
  };

  const score = Math.max(0, Math.min(10, Number(feedback.score) || 7));
  return { feedbackResult: { ...feedback, score }, scores: [score] };
}

async function adaptNode(state) {
  const {
    scores = [], assessment = {}, companyPatterns = {}, questionCount = 0,
    jobRole = "", topicAttempts = {}, currentTopic = "", topicsCovered = [],
    currentQuestion = "", interviewType = "technical_behavioral",
    practiceMode = "standard", candidateLevel = "fresher",
    allowedTopics = [], excludedTopics = [],
  } = state;

  const topics = (allowedTopics.length ? allowedTopics : getInterviewTopics(interviewType))
    .filter((t) => !excludedTopics.includes(t));

  const attempts = topicAttempts[currentTopic] || 0;
  const forceTopicChange = attempts >= MAX_ATTEMPTS_PER_TOPIC;
  const availableTopics = topics.filter((topic) => {
    if (forceTopicChange && topic === currentTopic) return false;
    return (topicAttempts[topic] || 0) < MAX_ATTEMPTS_PER_TOPIC;
  });
  const fallbackTopic = availableTopics[0] || topics.find((t) => t !== currentTopic) || topics[0];

  if (!fallbackTopic) throw new Error(`No valid topics configured for interview type: ${interviewType}`);

  const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : "5.0";
  const lastScore = scores.length ? scores[scores.length - 1] : 5;

  const prompt = `You are an adaptive technical interview agent.

Candidate role: ${jobRole}
Interview type: ${interviewType}
Practice mode: ${practiceMode}
Candidate level: ${candidateLevel}

ALLOWED TOPICS: ${topics.join(", ")}
EXCLUDED TOPICS: ${excludedTopics.length ? excludedTopics.join(", ") : "None"}

The selected interview type is the PRIMARY constraint.
Never select a topic outside ALLOWED TOPICS.
Never select an excluded topic.

Current topic: ${currentTopic || "None"}
Current topic attempts: ${attempts}
Topic attempts: ${JSON.stringify(topicAttempts)}
Topics covered: ${topicsCovered.join(", ") || "None"}
Previous question: ${currentQuestion || "None"}
Average score: ${avg}/10
Last score: ${lastScore}/10
Questions completed: ${questionCount}
Weak areas: ${assessment.weak_areas?.join(", ") || "None"}
Company focus: ${companyPatterns.focus_topics?.join(", ") || "None"}

Rules:
1. Interview type cannot be violated.
2. Select next_topic only from ALLOWED TOPICS.
3. Never select EXCLUDED TOPICS.
4. If the current topic reached ${MAX_ATTEMPTS_PER_TOPIC} attempts, change topic.
5. Do not repeat or merely rephrase the previous question.
6. If keeping the topic, test a substantially different concept.
7. Score >= 8 → Harder; 5-7 → Same; < 5 → Easier.
8. Match candidate level.

Return ONLY valid JSON:
{
  "decision": "why this topic and question were selected",
  "next_topic": "one allowed topic",
  "difficulty_adjustment": "Easier|Same|Harder",
  "next_question": "actual interview question"
}`;

  let adapt = null;
  try { adapt = parseJSON(await callAgentAdapt([{ role: "user", content: prompt }])); }
  catch (e) { console.warn("Adapt node failed:", e.message); }

  let nextTopic = canonicalTopic(adapt?.next_topic, topics);
  if (!nextTopic || (forceTopicChange && nextTopic === currentTopic) ||
      (topicAttempts[nextTopic] || 0) >= MAX_ATTEMPTS_PER_TOPIC) {
    nextTopic = fallbackTopic;
  }

  let nextQuestion = adapt?.next_question?.trim();
  if (!nextQuestion) {
    nextQuestion = `Let's move to ${nextTopic}. Can you explain an important concept in ${nextTopic} and give a practical example?`;
  }

  const updatedTopicAttempts = { ...topicAttempts };
  updatedTopicAttempts[nextTopic] = (updatedTopicAttempts[nextTopic] || 0) + 1;
  const updatedTopicsCovered = [...new Set([...topicsCovered, nextTopic])];

  return {
    adaptResult: {
      ...(adapt || {}),
      next_topic: nextTopic,
      next_question: nextQuestion,
      difficulty_adjustment: adapt?.difficulty_adjustment ||
        (lastScore >= 8 ? "Harder" : lastScore < 5 ? "Easier" : "Same"),
    },
    currentQuestion: cleanForVoice(nextQuestion),
    currentTopic: nextTopic,
    topicAttempts: updatedTopicAttempts,
    topicsCovered: updatedTopicsCovered,
    questionsPerTopic: updatedTopicAttempts[nextTopic],
  };
}

async function reportNode(state) {
  const { scores = [], assessment = {} } = state;
  const avg = scores.length
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10)
    : 60;
  return {
    sessionReport: {
      overallScore: avg,
      weakAreasIdentified: assessment.weak_areas || [],
      strongAreas: assessment.strong_areas || [],
      readinessScore: assessment.readiness_score || avg,
      nextSessionFocus: assessment.recommended_focus?.slice(0, 2) || [],
      interviewStrategy: assessment.interview_strategy || "",
    },
  };
}

function routeFromStart(state) {
  return state.graphMode === "answer" ? "feedback" : "research";
}

function routeAfterAdapt(state) {
  return state.questionCount >= MAX_QUESTIONS ? "report" : END;
}

function buildGraph() {
  return new StateGraph(InterviewState)
    .addNode("research", researchNode)
    .addNode("assess", assessNode)
    .addNode("question", questionNode)
    .addNode("feedback", feedbackNode)
    .addNode("adapt", adaptNode)
    .addNode("report", reportNode)
    .addConditionalEdges(START, routeFromStart, { research: "research", feedback: "feedback" })
    .addEdge("research", "assess")
    .addEdge("assess", "question")
    .addEdge("question", END)
    .addEdge("feedback", "adapt")
    .addConditionalEdges("adapt", routeAfterAdapt, { report: "report", [END]: END })
    .addEdge("report", END)
    .compile();
}

const interviewGraph = buildGraph();

export async function startInterviewAgent({
  jobRole, company, resumeText, existingPatterns,
  interviewType = "technical_behavioral",
  practiceMode = "standard",
  candidateLevel = "fresher",
  systemDesignMode = "ai_decide",
  allowedTopics,
  excludedTopics = [],
}) {
  const topics = (allowedTopics?.length ? allowedTopics : getInterviewTopics(interviewType)).filter(
    (topic) => !excludedTopics.includes(topic)
  );
  if (!topics.length) throw new Error(`No topics available for ${interviewType}`);

  const final = await interviewGraph.invoke({
    jobRole,
    company: company || "",
    resumeText: resumeText || "",
    existingPatterns: existingPatterns || null,
    graphMode: "start",
    questionCount: 0,
    scores: [],
    interviewType,
    practiceMode,
    candidateLevel,
    systemDesignMode,
    allowedTopics: topics,
    excludedTopics,
    topicAttempts: {},
    currentTopic: "",
    topicsCovered: [],
  });

  return {
    firstMessage: final.firstQuestion,
    companyPatterns: final.companyPatterns,
    assessment: final.assessment,
    topicChosen: final.topicChosen,
    questionCount: final.questionCount,
    topicAttempts: final.topicAttempts || {},
    currentTopic: final.currentTopic || final.topicChosen,
    topicsCovered: final.topicsCovered || [],
    allowedTopics: topics,
    excludedTopics,
  };
}

export async function processAnswerAgent({
  jobRole, company, resumeText, existingPatterns,
  companyPatterns, assessment, currentQuestion, currentAnswer,
  questionCount, scores,
  interviewType = "technical_behavioral",
  practiceMode = "standard",
  candidateLevel = "fresher",
  systemDesignMode = "ai_decide",
  topicAttempts = {}, currentTopic = "", topicsCovered = [],
  allowedTopics, excludedTopics = [],
}) {
  const topics = (allowedTopics?.length ? allowedTopics : getInterviewTopics(interviewType)).filter(
    (topic) => !excludedTopics.includes(topic)
  );

  const final = await interviewGraph.invoke({
    jobRole,
    company: company || "",
    resumeText: resumeText || "",
    existingPatterns: existingPatterns || null,
    companyPatterns,
    assessment,
    currentQuestion,
    currentAnswer,
    questionCount,
    scores: scores || [],
    graphMode: "answer",
    interviewType,
    practiceMode,
    candidateLevel,
    systemDesignMode,
    allowedTopics: topics,
    excludedTopics,
    topicAttempts: topicAttempts || {},
    currentTopic: currentTopic || "",
    topicsCovered: topicsCovered || [],
  });

  const fb = final.feedbackResult;
  const adapt = final.adaptResult;
  const isLast = questionCount >= MAX_QUESTIONS;
  const updatedScores = [...(scores || []), fb?.score || 7];

  if (isLast || final.sessionReport) {
    const report = final.sessionReport || {
      overallScore: Math.round((updatedScores.reduce((a, b) => a + b, 0) / updatedScores.length) * 10),
      weakAreasIdentified: assessment?.weak_areas || [],
      strongAreas: assessment?.strong_areas || [],
      nextSessionFocus: assessment?.recommended_focus?.slice(0, 2) || [],
    };

    return {
      message: cleanForVoice(
        `That wraps up our interview. You scored an average of ${report.overallScore} percent. ` +
        `Your strongest areas were ${(report.strongAreas || []).slice(0, 2).join(" and ")}. ` +
        `For your next session, focus on ${(report.nextSessionFocus || []).join(" and ")}.`
      ),
      feedback: cleanForVoice(fb?.feedback || "Good effort."),
      score: fb?.score || 7,
      agentReasoning: cleanForVoice(fb?.agent_reasoning || ""),
      specificMistake: cleanForVoice(fb?.specific_mistake || ""),
      suggestedImprovement: cleanForVoice(fb?.suggested_improvement || ""),
      isComplete: true,
      overallScore: report.overallScore,
      adaptDecision: null,
      sessionReport: report,
      updatedScores,
      updatedTopicAttempts: final.topicAttempts || topicAttempts,
      nextTopic: final.currentTopic || currentTopic,
      updatedTopicsCovered: final.topicsCovered || topicsCovered,
    };
  }

  return {
    message: cleanForVoice(adapt?.next_question || "Let's continue."),
    feedback: cleanForVoice(fb?.feedback || "Good attempt."),
    score: fb?.score || 7,
    agentReasoning: cleanForVoice(fb?.agent_reasoning || ""),
    specificMistake: cleanForVoice(fb?.specific_mistake || ""),
    suggestedImprovement: cleanForVoice(fb?.suggested_improvement || ""),
    isComplete: false,
    overallScore: null,
    adaptDecision: {
      decision: adapt?.decision || "",
      nextTopic: final.currentTopic || adapt?.next_topic || "",
      difficultyAdjustment: adapt?.difficulty_adjustment || "Same",
    },
    nextQuestion: cleanForVoice(adapt?.next_question || ""),
    updatedScores,
    updatedTopicAttempts: final.topicAttempts || {},
    nextTopic: final.currentTopic || "",
    updatedTopicsCovered: final.topicsCovered || [],
  };
}

export { MAX_QUESTIONS, MAX_ATTEMPTS_PER_TOPIC, TOPICS, getInterviewTopics };
