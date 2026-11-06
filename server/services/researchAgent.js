// ============================================================
//  services/researchAgent.js  —  Deep Research Agent (Agent 1)
//
//  TRUE ReAct loop:
//  PLAN → SEARCH → EVALUATE → (loop if gaps) → SYNTHESIZE
//
//  The MODEL decides:
//    • what queries to run (not hardcoded)
//    • whether results are sufficient or more searches needed
//    • what to search next if gap found
//
//  emit(event) callback → SSE controller streams each step live
//  Max 5 searches hard cap (free tier Serper = 100/month)
//
//  Output: backward-compat shape + companyPatterns for Agent 2
// ============================================================

import { AI_CONFIG }        from "../config/ai.config.js";
import { callWithChain, parseJSON } from "./aiHelper.js";

const MAX_SEARCHES = 5;

// ── Serper web search ──────────────────────────────────────
async function webSearch(query) {
  const apiKey = AI_CONFIG.serper.apiKey();
  if (!apiKey) {
    console.log("⚠ No SERPER_API_KEY — AI knowledge only");
    return null;
  }
  try {
    const res = await fetch(AI_CONFIG.serper.endpoint, {
      method:  "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body:    JSON.stringify({ q: query, num: AI_CONFIG.serper.resultsPerQuery }),
    });
    const data = await res.json();
    const results = (data.organic || []).slice(0, 5);
    if (!results.length) return null;
    return results
      .map((r) => `• ${r.title}\n  ${r.snippet}\n  ${r.link}`)
      .join("\n\n");
  } catch (err) {
    console.warn("Serper error:", err.message);
    return null;
  }
}

// ── PHASE 1: PLAN ─────────────────────────────────────────
// AI decides the first 2–3 queries to run based on type + query.
// This is where the model's first autonomous decision happens.
async function planPhase(query, type, emit) {
  emit({ phase: "planning", message: `Agent planning search strategy for "${query}"...` });

  const typeContext = {
    "Company Research":    `interview process, tech stack, culture, salary at ${query}`,
    "Role Research":       `skills required, career path, interview questions for ${query}`,
    "Learning Resources":  `best resources, roadmap, project ideas for learning ${query}`,
  }[type] || `research on ${query}`;

  const prompt = `You are a research agent planning a web search strategy.

Goal: Research "${query}" — type: ${type}
Context: ${typeContext}

Decide the best 2-3 search queries to start with. Think about what gaps a job seeker would have.
Return ONLY valid JSON:
{
  "queries": ["specific search query 1", "specific search query 2", "specific search query 3"],
  "reasoning": "one sentence: why these specific queries"
}`;

  const raw = await callWithChain("agent_plan", [{ role: "user", content: prompt }]);
  const parsed = parseJSON(raw);

  if (!parsed?.queries?.length) {
    // Fallback plan if AI returns garbage
    const fallback = {
      "Company Research":   [`${query} interview process 2025`, `${query} tech stack engineering team`, `${query} software engineer salary India`],
      "Role Research":      [`${query} skills required 2025`, `${query} interview questions`, `how to become ${query}`],
      "Learning Resources": [`best way to learn ${query} 2025`, `${query} beginner roadmap`, `${query} project ideas`],
    }[type] || [`${query} 2025`];
    return { queries: fallback, reasoning: "Using default search strategy." };
  }

  emit({ phase: "plan_ready", queries: parsed.queries, reasoning: parsed.reasoning });
  return parsed;
}

// ── PHASE 2: SEARCH ───────────────────────────────────────
async function searchPhase(query, allCollected, emit) {
  emit({ phase: "searching", query, message: `Searching: "${query}"` });
  const result = await webSearch(query);

  if (!result) {
    emit({ phase: "search_done", query, found: false, message: `No results for "${query}" — using AI knowledge` });
    return null;
  }

  const lines = result.split("\n").filter((l) => l.startsWith("•")).length;
  emit({ phase: "search_done", query, found: true, resultCount: lines, message: `Found ${lines} results for "${query}"` });
  return result;
}

// ── PHASE 3: EVALUATE ─────────────────────────────────────
// The core of the ReAct loop.
// AI looks at ALL results collected so far and decides:
//   - "sufficient" → proceed to synthesize
//   - "need_more"  → provide the next query to run
async function evaluatePhase(query, type, allResults, searchCount, emit) {
  emit({ phase: "evaluating", message: `Evaluating coverage after ${searchCount} search${searchCount > 1 ? "es" : ""}...` });

  if (searchCount >= MAX_SEARCHES) {
    emit({ phase: "eval_done", decision: "sufficient", reason: "Reached maximum search limit — synthesizing now." });
    return { decision: "sufficient", reason: "Max searches reached." };
  }

  const collectedSummary = allResults
    .map((r, i) => `Search ${i + 1} (${r.query}):\n${r.content?.substring(0, 400) || "no results"}`)
    .join("\n\n---\n\n");

  const prompt = `You are evaluating research completeness for a job seeker.

Topic: "${query}" (${type})
Searches done so far (${searchCount}): 
${collectedSummary}

Based on what was found, decide:
1. Is there enough information to write a useful, specific report about "${query}"?
2. What critical information is still missing (if any)?

For ${type === "Company Research" ? "company research" : type === "Role Research" ? "role research" : "learning resources"}, you need:
${type === "Company Research" ? "- Interview process details\n- Tech stack used\n- Typical question types\n- Salary/culture info" : ""}
${type === "Role Research" ? "- Core skills required\n- Typical interview questions\n- Salary range\n- Career progression" : ""}
${type === "Learning Resources" ? "- Best learning platforms\n- Structured roadmap\n- Project ideas to build\n- Timeline to learn" : ""}

Return ONLY valid JSON:
{
  "decision": "sufficient" or "need_more",
  "reason": "one sentence explaining the decision",
  "gap": "what specific information is missing (empty string if sufficient)",
  "next_query": "the exact search query to fill the gap (empty string if sufficient)"
}`;

  const raw = await callWithChain("agent_plan", [{ role: "user", content: prompt }]);
  const parsed = parseJSON(raw);

  if (!parsed) {
    return { decision: "sufficient", reason: "Could not evaluate — proceeding with available data." };
  }

  emit({
    phase: "eval_done",
    decision: parsed.decision,
    reason: parsed.reason,
    gap: parsed.gap,
    nextQuery: parsed.next_query,
    message: parsed.decision === "sufficient"
      ? `✓ Coverage sufficient — ${parsed.reason}`
      : `Gap found: ${parsed.gap}`,
  });

  return parsed;
}

// ── PHASE 4: SYNTHESIZE ───────────────────────────────────
// One final AI call that generates the full structured report
// from ALL search results collected during the ReAct loop.
async function synthesizePhase(query, type, allResults, emit) {
  emit({ phase: "synthesizing", message: "Synthesizing all findings into report..." });

  const allData = allResults
    .map((r, i) => `=== Source ${i + 1}: "${r.query}" ===\n${r.content || "No results"}`)
    .join("\n\n");

  const typeInstruction = {
    "Company Research":   `Research the company "${query}" for someone preparing for interviews there.`,
    "Role Research":      `Explain the job role "${query}" for someone preparing to apply.`,
    "Learning Resources": `Create a learning guide for "${query}" for a beginner/intermediate developer.`,
  }[type] || `Research "${query}".`;

  const prompt = `You are an expert career coach synthesizing research for a job seeker.

${typeInstruction}

All gathered web data:
${allData}

Generate a comprehensive, specific report. Use actual data from the search results where possible.
Return ONLY valid JSON (no markdown fences):
{
  "title": "specific report title",
  "summary": "3-4 sentences summarizing key findings specific to ${query}",
  "key_findings": ["specific finding 1", "specific finding 2", "specific finding 3", "specific finding 4", "specific finding 5"],
  "patterns": ["recurring theme 1", "recurring theme 2", "recurring theme 3"],
  "skills_required": ["skill 1", "skill 2", "skill 3", "skill 4", "skill 5"],
  "interview_tips": ["specific tip 1", "specific tip 2", "specific tip 3", "specific tip 4"],
  "interview_rounds": ["round 1 description", "round 2 description", "round 3 description"],
  "focus_topics": ["topic 1", "topic 2", "topic 3", "topic 4"],
  "difficulty_level": "Easy|Medium|Hard",
  "commonly_asked": ["question type 1", "question type 2", "question type 3"],
  "resources": [
    { "name": "resource name", "type": "YouTube|Course|Docs|Book|Practice", "url": "url or empty", "description": "one line" }
  ],
  "roadmap": ["step 1", "step 2", "step 3", "step 4", "step 5"],
  "salary_range": "salary info or empty string",
  "action_plan": ["this week: action", "this month: action", "in 3 months: action"],
  "reasoning": "2-3 sentences explaining how you arrived at these conclusions from the data"
}`;

  const raw = await callWithChain("research", [{ role: "user", content: prompt }], 0.3);
  const parsed = parseJSON(raw);

  if (!parsed) {
    throw new Error("Synthesis failed — AI returned unparseable response");
  }

  emit({ phase: "synthesized", message: "Report generated successfully" });
  return parsed;
}

// ── Main Agent Entry Point ────────────────────────────────
// emit(event) is called throughout for SSE streaming
export async function runResearchAgent(query, type, emit = () => {}) {
  console.log(`\n🚀 Deep Research Agent: "${query}" (${type})`);

  const allResults   = [];   // { query, content } for every search run
  const agentTrace   = [];   // full decision log for transparency
  let   searchCount  = 0;

  try {
    // ── Phase 1: Plan ──────────────────────────────────────
    const plan = await planPhase(query, type, emit);
    agentTrace.push({ phase: "plan", queries: plan.queries, reasoning: plan.reasoning });

    // Run first batch of planned queries
    for (const q of plan.queries) {
      const content = await searchPhase(q, allResults, emit);
      allResults.push({ query: q, content });
      searchCount++;
      agentTrace.push({ phase: "search", query: q, found: !!content });
    }

    // ── ReAct loop: Evaluate → Search → Evaluate... ────────
    let loopCount = 0;
    while (loopCount < 3) { // max 3 extra searches on top of initial plan
      const evaluation = await evaluatePhase(query, type, allResults, searchCount, emit);
      agentTrace.push({ phase: "evaluate", ...evaluation });

      if (evaluation.decision === "sufficient" || !evaluation.next_query) break;

      // Agent decided it needs more — run the additional search
      const content = await searchPhase(evaluation.next_query, allResults, emit);
      allResults.push({ query: evaluation.next_query, content });
      searchCount++;
      agentTrace.push({ phase: "search", query: evaluation.next_query, found: !!content });
      loopCount++;
    }

    // ── Phase 4: Synthesize ────────────────────────────────
    const report = await synthesizePhase(query, type, allResults, emit);
    agentTrace.push({ phase: "synthesize", topicsFound: report.focus_topics?.length });

    // Build final output — backward-compat + Agent 2 handoff fields
    const sourcesFound    = allResults.filter((r) => r.content).length * 5;
    const topicsIdentified = (report.focus_topics?.length || 0) + (report.patterns?.length || 0);

    const output = {
      // ── Fields your existing frontend reads ──────────────
      stats: {
        searchesPerformed: searchCount,
        sourcesFound,
        topicsIdentified,
      },
      agentThinking: {
        searchStrategy: allResults.map((r) => r.query),
        phasesCompleted: agentTrace.map((t) => t.phase),
        evaluations: agentTrace.filter((t) => t.phase === "evaluate"),
      },
      insights: {
        key_findings:    report.key_findings    || [],
        patterns:        report.patterns        || [],
        skills_required: report.skills_required || [],
        interview_tips:  report.interview_tips  || [],
        reasoning:       report.reasoning       || "",
      },
      // ── Full report fields (for rich UI) ─────────────────
      title:        report.title,
      summary:      report.summary,
      roadmap:      report.roadmap      || [],
      resources:    report.resources    || [],
      salary_range: report.salary_range || "",
      action_plan:  report.action_plan  || [],
      // ── Agent 2 (Interview Prep Agent) handoff ────────────
      // interviewAgent.js stepResearch() returns this exact shape.
      // If user ran Research Agent first, Interview Agent can skip
      // its own Step 1 and use this data directly.
      companyPatterns: {
        interview_rounds:  report.interview_rounds  || [],
        focus_topics:      report.focus_topics      || [],
        difficulty_level:  report.difficulty_level  || "Medium",
        commonly_asked:    report.commonly_asked     || [],
        key_skills_needed: report.skills_required   || [],
        company_summary:   report.summary           || "",
      },
      // ── Agent trace for full transparency ─────────────────
      agentTrace,
    };

    emit({ phase: "complete", output });
    console.log(`✅ Research Agent done: ${searchCount} searches, ${topicsIdentified} topics`);
    return output;

  } catch (err) {
    console.error("Research Agent error:", err.message);
    emit({ phase: "error", message: err.message });
    throw err;
  }
}

// ── Backward-compat export used by old controller ─────────
export async function deepResearch(query, type = "Company Research") {
  return runResearchAgent(query, type);
}
