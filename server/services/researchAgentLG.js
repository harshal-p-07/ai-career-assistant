// ============================================================
//  services/researchAgentLG.js
//  Deep Research Agent — LangGraph JS
//
//  Graph: plan → search → evaluate → [search(loop) | synthesize]
//
//  The MODEL decides:
//   • what queries to run           (planNode)
//   • whether results are enough    (evaluateNode)
//   • what to search next if gap    (evaluateNode → searchNode loop)
//
//  emit(event) → live SSE events to frontend
//  Hard cap: MAX_SEARCHES = 5 (Serper free tier protection)
// ============================================================

import { StateGraph, Annotation, END, START } from "@langchain/langgraph";
import { callResearchAI, parseJSON } from "./aiHelper.js";

const MAX_SEARCHES = 5;

// ── State ─────────────────────────────────────────────────────
const ResearchState = Annotation.Root({
  query:          Annotation({ reducer: (_, b) => b }),
  type:           Annotation({ reducer: (_, b) => b }),
  emit:           Annotation({ reducer: (_, b) => b }),

  plannedQueries: Annotation({ reducer: (_, b) => b,               default: () => [] }),
  allResults:     Annotation({ reducer: (a, b) => [...a, ...b],    default: () => [] }),
  searchCount:    Annotation({ reducer: (_, b) => b,               default: () => 0 }),
  decision:       Annotation({ reducer: (_, b) => b,               default: () => "" }),
  nextQuery:      Annotation({ reducer: (_, b) => b,               default: () => "" }),
  report:         Annotation({ reducer: (_, b) => b,               default: () => null }),
  agentTrace:     Annotation({ reducer: (a, b) => [...a, ...b],    default: () => [] }),
});

// ── Serper web search ─────────────────────────────────────────
async function webSearch(query) {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) { console.log("⚠ No SERPER_API_KEY"); return null; }
  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, num: 5 }),
    });
    const data = await res.json();
    return (data.organic || []).slice(0, 5)
      .map(r => `• ${r.title}\n  ${r.snippet}\n  ${r.link}`).join("\n\n") || null;
  } catch (e) { console.warn("Serper:", e.message); return null; }
}

// ── NODE 1: Plan ──────────────────────────────────────────────

// ── NODE 1: Plan ──────────────────────────────────────────────
async function planNode(state) {
  const { query, type, emit } = state;

  const now = new Date();

  // Indian local date
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const get = (key) => parts.find(p => p.type === key)?.value;

  const currentDate = `${get("year")}-${get("month")}-${get("day")}`;
  const currentYear = Number(get("year"));
  const month = Number(get("month"));

  const fyStart = month >= 4 ? currentYear : currentYear - 1;
  const latestFY = `FY${fyStart - 1}-${String(fyStart).slice(-2)}`;

  emit({
    phase: "planning",
    message: `Planning research for "${query}"...`,
  });

  console.log(`\n[LG Research] PLAN — "${query}" (${type})`);

  const contexts = {
    company: `Company overview, latest developments, technology and financials; India fresher hiring, careers and interview process.`,
    role: `Current skills, responsibilities and technologies; interview questions, salary and career opportunities.`,
    learning: `Latest official documentation and concepts; learning roadmap, projects and practical resources.`,
  };

  const prompt = `
You are a web research planning agent.

Date: ${currentDate}
Year: ${currentYear}
Latest completed financial year: ${latestFY}

Subject: ${query}
Type: ${type}

Research objective:
${contexts[type] || `Research ${query} comprehensively.`}

Generate EXACTLY 2 short, distinct search queries:
1. Cover the most important general/current information.
2. Cover the most important practical or career-related information.

Prefer recent and official sources.
Use ${currentYear} for current developments.
Use the latest available financial information.
Avoid outdated years unless historical comparison is needed.

Return ONLY valid JSON:
{
  "queries": ["query 1", "query 2"],
  "reasoning": "One short sentence."
}
`;

  let parsed = null;

  try {
    const raw = await callResearchAI([
      { role: "user", content: prompt },
    ]);

    parsed = parseJSON(raw);
  } catch (e) {
    console.warn("Plan AI failed:", e.message);
  }

  const fallback = {
    company: [
      `${query} latest company overview technology financial results ${currentYear}`,
      `${query} India fresher hiring interview process careers ${currentYear}`,
    ],
    role: [
      `${query} current skills responsibilities salary`,
      `${query} technical interview questions career roadmap`,
    ],
    learning: [
      `${query} official documentation latest concepts`,
      `${query} learning roadmap practical projects`,
    ],
  }[type] || [
    `${query} latest information ${currentYear}`,
    `${query} applications and practical use cases`,
  ];

  const validQueries = Array.isArray(parsed?.queries)
    ? [...new Set(
        parsed.queries
          .filter(q => typeof q === "string")
          .map(q => q.trim())
          .filter(Boolean)
      )].slice(0, 2)
    : [];

  const queries =
    validQueries.length === 2 ? validQueries : fallback;

  const reasoning =
    parsed?.reasoning || "Using date-aware search strategy.";

  emit({
    phase: "plan_ready",
    queries,
    reasoning,
  });

  console.log("[LG Research] Queries:", queries);

  return {
    plannedQueries: queries,
    researchDate: currentDate,
    agentTrace: [{
      phase: "plan",
      queries,
      reasoning,
      researchDate: currentDate,
    }],
  };
}


// ── NODE 2: Search ────────────────────────────────────────────
async function searchNode(state) {
  const { plannedQueries, searchCount, decision, nextQuery, emit } = state;

  // First visits use planned queries; loop visits use nextQuery from evaluate
  const isLoop  = decision === "need_more" && nextQuery;
  const query   = isLoop ? nextQuery : (plannedQueries[searchCount] || plannedQueries[0]);

  emit({ phase: "searching", query, message: `Searching: "${query}"` });
  console.log(`[LG Research] SEARCH #${searchCount + 1} — "${query}"`);

  const content = await webSearch(query);
  const found   = !!content;

  emit({
    phase: "search_done", query, found,
    resultCount: found ? content.split("•").length - 1 : 0,
    message: found ? `Found results for "${query}"` : `No results — using AI knowledge`,
  });

  return {
    allResults:  [{ query, content }],
    searchCount: searchCount + 1,
    agentTrace:  [{ phase: "search", query, found }],
  };
}

// ── NODE 3: Evaluate ──────────────────────────────────────────
// Core ReAct decision — model decides: sufficient OR need_more
async function evaluateNode(state) {
  const { query, type, allResults, searchCount, emit } = state;

  emit({ phase: "evaluating", message: `Evaluating coverage after ${searchCount} search${searchCount > 1 ? "es" : ""}...` });
  console.log(`[LG Research] EVALUATE — ${searchCount} searches done`);

  if (searchCount >= MAX_SEARCHES) {
    const reason = "Reached max search limit — synthesizing now.";
    emit({ phase: "eval_done", decision: "sufficient", reason });
    return { decision: "sufficient", reason, agentTrace: [{ phase: "evaluate", decision: "sufficient" }] };
  }

  const summary = allResults
    .map((r, i) => `Search ${i + 1} (${r.query}):\n${r.content?.substring(0, 400) || "no results"}`)
    .join("\n\n---\n\n");

  const needs = {
    company:  "interview process, tech stack, question types, salary/culture",
    role:     "core skills, salary range, career progression, interview patterns",
    learning: "best platforms, structured roadmap, project ideas, timeline",
  }[type] || "comprehensive overview";

  const prompt = `Evaluate if this research data is sufficient for a job seeker.
Topic: "${query}" (${type})
Data collected (${searchCount} searches):
${summary}

Needed for ${type}: ${needs}

Return ONLY valid JSON:
{
  "decision": "sufficient" or "need_more",
  "reason": "one sentence",
  "gap": "what is missing (empty if sufficient)",
  "next_query": "exact search query to fill gap (empty if sufficient)"
}`;

  let parsed = null;
  try {
    const raw = await callResearchAI([{ role: "user", content: prompt }]);
    parsed = parseJSON(raw);
  } catch (e) {
    console.warn("Evaluate AI failed:", e.message);
    parsed = { decision: "sufficient", reason: "Proceeding with available data.", gap: "", next_query: "" };
  }

  const { decision, reason, gap, next_query } = parsed;
  emit({
    phase: "eval_done", decision, reason, gap, nextQuery: next_query,
    message: decision === "sufficient" ? `✓ ${reason}` : `Gap: ${gap}`,
  });

  return {
    decision,
    nextQuery:  next_query || "",
    agentTrace: [{ phase: "evaluate", decision, reason, gap }],
  };
}

// ── NODE 4: Synthesize ────────────────────────────────────────
async function synthesizeNode(state) {
  const { query, type, allResults, emit } = state;

  emit({ phase: "synthesizing", message: "Synthesizing all findings into report..." });
  console.log(`[LG Research] SYNTHESIZE`);

  const allData = allResults
    .map((r, i) => `=== Source ${i + 1}: "${r.query}" ===\n${r.content || "No results"}`)
    .join("\n\n");

  const instruction = {
    company:  `Research the company "${query}" for someone preparing for interviews there.`,
    role:     `Explain the job role "${query}" for someone preparing to apply.`,
    learning: `Create a learning guide for "${query}" for a developer.`,
  }[type] || `Research "${query}".`;

  const prompt = `You are an expert career coach synthesizing research.

${instruction}

All web data gathered:
${allData}

Return ONLY valid JSON (no markdown):
{
  "title": "specific report title",
  "summary": "3-4 sentences of key findings",
  "key_findings": ["finding 1","finding 2","finding 3","finding 4","finding 5"],
  "patterns": ["pattern 1","pattern 2","pattern 3"],
  "skills_required": ["skill 1","skill 2","skill 3","skill 4","skill 5"],
  "interview_tips": ["tip 1","tip 2","tip 3","tip 4"],
  "interview_rounds": ["round 1","round 2","round 3"],
  "focus_topics": ["topic 1","topic 2","topic 3","topic 4"],
  "difficulty_level": "Easy|Medium|Hard",
  "commonly_asked": ["type 1","type 2","type 3"],
  "resources": [{"name":"name","type":"YouTube|Course|Docs","url":"","description":"one line"}],
  "roadmap": ["step 1","step 2","step 3","step 4","step 5"],
  "salary_range": "salary info or empty",
  "action_plan": ["this week: action","this month: action","in 3 months: action"],
  "reasoning": "how conclusions were reached"
}`;

  const raw    = await callResearchAI([{ role: "user", content: prompt }], 0.3);
  const report = parseJSON(raw);

  emit({ phase: "synthesized", message: "Report generated successfully" });
  return { report, agentTrace: [{ phase: "synthesize" }] };
}

// ── Router functions ──────────────────────────────────────────
function routeAfterSearch(state) {
  // Still have planned queries to run → search again
  if (state.searchCount < state.plannedQueries.length) return "search";
  // All planned done → evaluate
  return "evaluate";
}

function routeAfterEvaluate(state) {
  if (state.decision === "need_more" && state.nextQuery && state.searchCount < MAX_SEARCHES) {
    return "search"; // loop back for gap query
  }
  return "synthesize";
}

// ── Build & compile graph ─────────────────────────────────────
function buildGraph() {
  return new StateGraph(ResearchState)
    .addNode("plan",       planNode)
    .addNode("search",     searchNode)
    .addNode("evaluate",   evaluateNode)
    .addNode("synthesize", synthesizeNode)
    .addEdge(START,        "plan")
    .addEdge("plan",       "search")
    .addConditionalEdges("search",   routeAfterSearch,   { search: "search", evaluate: "evaluate" })
    .addConditionalEdges("evaluate", routeAfterEvaluate, { search: "search", synthesize: "synthesize" })
    .addEdge("synthesize", END)
    .compile();
}

const researchGraph = buildGraph();

// ── Public entry point ────────────────────────────────────────
export async function runResearchAgent(query, type = "company", emit = () => {}) {
  console.log(`\n [LangGraph] Research Agent: "${query}" (${type})`);

  const finalState = await researchGraph.invoke({
    query, type, emit,
    plannedQueries: [], allResults: [],
    searchCount: 0, decision: "", nextQuery: "",
    report: null, agentTrace: [],
  });

  if (!finalState.report) throw new Error("Synthesis failed — no report generated");

  const { report, allResults, searchCount, agentTrace } = finalState;
  const sourcesFound     = allResults.filter(r => r.content).length * 5;
  const topicsIdentified = (report.focus_topics?.length || 0) + (report.patterns?.length || 0);

  const output = {
    // Backward-compat shape (existing frontend reads these)
    stats: { searchesPerformed: searchCount, sourcesFound, topicsIdentified },
    agentThinking: {
      searchStrategy: allResults.map(r => r.query),
      phasesCompleted: agentTrace.map(t => t.phase),
      evaluations: agentTrace.filter(t => t.phase === "evaluate"),
    },
    insights: {
      key_findings:    report.key_findings    || [],
      patterns:        report.patterns        || [],
      skills_required: report.skills_required || [],
      interview_tips:  report.interview_tips  || [],
      reasoning:       report.reasoning       || "",
    },
    title:        report.title,
    summary:      report.summary,
    roadmap:      report.roadmap      || [],
    resources:    report.resources    || [],
    salary_range: report.salary_range || "",
    action_plan:  report.action_plan  || [],
    // Agent 2 handoff payload
    companyPatterns: {
      interview_rounds:  report.interview_rounds  || [],
      focus_topics:      report.focus_topics      || [],
      difficulty_level:  report.difficulty_level  || "Medium",
      commonly_asked:    report.commonly_asked    || [],
      key_skills_needed: report.skills_required   || [],
      company_summary:   report.summary           || "",
    },
    agentTrace,
  };

  emit({ phase: "complete", output });
  console.log(`[LangGraph] Research done: ${searchCount} searches, ${topicsIdentified} topics`);
  return output;
}

// Backward-compat alias
export const deepResearch = (q, t) => runResearchAgent(q, t || "company");
