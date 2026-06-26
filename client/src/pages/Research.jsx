import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, CheckCircle2, Loader2, AlertCircle, ArrowRight, RotateCcw, Clock } from "lucide-react";
import { streamResearch, getResearchHistory } from "../services/api.js";
import DashboardLayout from "../components/DashboardLayout.jsx";
import { Card, Badge } from "../components/ui.jsx";

const TYPES = ["Company Research", "Role Research", "Learning Resources"];

// Maps SSE phase → human label
const PHASE_LABEL = {
  planning:     "Planning search strategy",
  plan_ready:   "Search plan ready",
  searching:    "Searching the web",
  search_done:  "Results collected",
  evaluating:   "Evaluating coverage",
  eval_done:    "Coverage assessed",
  synthesizing: "Synthesizing report",
  synthesized:  "Report generated",
  saved:        "Saved to history",
};

const PHASE_STATUS = {
  planning: "active", plan_ready: "done",
  searching: "active", search_done: "done",
  evaluating: "active", eval_done: "done",
  synthesizing: "active", synthesized: "done",
  saved: "done", error: "error",
};

export default function Research() {
  const [type,   setType]   = useState("Company Research");
  const [input,  setInput]  = useState("");
  const [stage,  setStage]  = useState("idle"); // idle | streaming | done | error
  const [events, setEvents] = useState([]);     // live SSE event log
  const [result, setResult] = useState(null);
  const [error,  setError]  = useState("");
  const [history, setHistory] = useState([]);
  const [researchId, setResearchId] = useState(null);
  const eventsEndRef = useRef();
  const navigate = useNavigate();

  useEffect(() => {
    getResearchHistory().then((r) => setHistory(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  const addEvent = (ev) => setEvents((prev) => [...prev, { ...ev, ts: Date.now() }]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    setStage("streaming");
    setEvents([]);
    setResult(null);
    setError("");
    setResearchId(null);

    try {
      const id = await streamResearch({ query: input.trim(), type }, (ev) => {
        addEvent(ev);
        if (ev.phase === "complete") setResult(ev.output);
        if (ev.phase === "error")   { setError(ev.message); setStage("error"); }
      });

      setResearchId(id);
      setStage("done");
      getResearchHistory().then((r) => setHistory(r.data)).catch(() => {});

    } catch (err) {
      setError(err.message || "Research failed.");
      setStage("error");
    }
  };

  const reset = () => {
    setStage("idle"); setEvents([]); setResult(null);
    setError(""); setInput(""); setResearchId(null);
  };

  const goToInterview = () => {
    // Pass researchId so Interview Agent (Agent 2) can skip its own Step 1
    navigate("/interview", { state: { researchId, company: input, jobRole: result?.companyPatterns ? input : "" } });
  };

  return (
    <DashboardLayout>
      <div className="p-8 max-w-4xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-1">Deep Research Agent</h1>
          <p className="text-muted-foreground">
            ReAct loop — AI plans queries, evaluates coverage, loops until sufficient, then synthesizes
          </p>
        </div>

        {/* Type tabs */}
        {stage === "idle" && (
          <div className="flex gap-2 flex-wrap">
            {TYPES.map((t) => (
              <button key={t} onClick={() => setType(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  type === t
                    ? "bg-primary/15 text-primary border-primary/40"
                    : "bg-secondary text-muted-foreground border-border hover:border-primary/30"
                }`}
              >{t}</button>
            ))}
          </div>
        )}

        {/* Search form */}
        {stage === "idle" && (
          <Card>
            <form onSubmit={handleSearch} className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">
                  {type === "Company Research" ? "Company Name" : type === "Role Research" ? "Job Role" : "Topic"}
                </label>
                <input value={input} onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    type === "Company Research" ? "e.g., TCS, Razorpay, Google" :
                    type === "Role Research"    ? "e.g., Backend Engineer, SDE Intern" :
                    "e.g., System Design, React, DSA"
                  }
                  className="w-full px-3 py-2.5 bg-input border border-border rounded-lg text-foreground placeholder-muted-foreground text-sm focus:border-primary transition-colors"
                />
              </div>
              <button type="submit"
                className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
                <Search className="w-4 h-4" /> Start Research
              </button>
            </form>
          </Card>
        )}

        {/* ── Live Agent Event Stream ────────────────────── */}
        {(stage === "streaming" || stage === "done") && events.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground">
                 Agent Live Trace
                {stage === "streaming" && (
                  <span className="ml-2 text-xs text-primary font-normal">running...</span>
                )}
              </h3>
              {stage === "done" && (
                <span className="text-xs text-success flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Complete
                </span>
              )}
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {events.map((ev, i) => {
                const status = PHASE_STATUS[ev.phase] || "done";
                return (
                  <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border text-sm transition-colors ${
                    status === "active" ? "bg-primary/5 border-primary/20" :
                    status === "error"  ? "bg-destructive/5 border-destructive/20" :
                    "bg-card border-border"
                  }`}>
                    <span className="flex-shrink-0 mt-0.5">
                      {status === "active" ? <Loader2 className="w-3.5 h-3.5 text-primary animate-spin-slow" /> :
                       status === "error"  ? <AlertCircle className="w-3.5 h-3.5 text-destructive" /> :
                                             <CheckCircle2 className="w-3.5 h-3.5 text-success" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-foreground">
                        {PHASE_LABEL[ev.phase] || ev.phase}
                      </span>
                      {/* Phase-specific detail */}
                      {ev.phase === "plan_ready" && ev.queries && (
                        <div className="mt-1.5 space-y-0.5">
                          {ev.queries.map((q, j) => (
                            <div key={j} className="text-xs text-muted-foreground flex gap-1.5">
                              <span className="text-primary font-medium">{j + 1}.</span> {q}
                            </div>
                          ))}
                          {ev.reasoning && (
                            <div className="text-xs text-muted-foreground/70 mt-1 italic">{ev.reasoning}</div>
                          )}
                        </div>
                      )}
                      {ev.phase === "searching" && (
                        <div className="text-xs text-muted-foreground mt-0.5">"{ev.query}"</div>
                      )}
                      {ev.phase === "search_done" && ev.found && (
                        <div className="text-xs text-success mt-0.5">{ev.resultCount} results · "{ev.query}"</div>
                      )}
                      {ev.phase === "eval_done" && (
                        <div className="mt-1">
                          <Badge variant={ev.decision === "sufficient" ? "success" : "warning"}>
                            {ev.decision === "sufficient" ? "Sufficient" : "Gap found"}
                          </Badge>
                          <span className="text-xs text-muted-foreground ml-2">{ev.reason}</span>
                          {ev.decision === "need_more" && ev.nextQuery && (
                            <div className="text-xs text-primary mt-1">→ Next: "{ev.nextQuery}"</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={eventsEndRef} />
            </div>
          </div>
        )}

        {/* ── Error ─────────────────────────────────────── */}
        {stage === "error" && (
          <Card>
            <p className="text-destructive text-sm mb-4">{error}</p>
            <button onClick={reset} className="px-4 py-2 bg-secondary border border-border rounded-lg text-sm text-foreground hover:border-primary/40 transition-colors">
              Try Again
            </button>
          </Card>
        )}

        {/* ── Full Results ──────────────────────────────── */}
        {result && stage === "done" && (
          <div className="space-y-6 fade-up">

            {/* Stats + handoff */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="text-center py-4">
                <p className="text-muted-foreground text-xs mb-1">Searches Run</p>
                <p className="text-2xl font-bold text-primary">{result.stats?.searchesPerformed || 0}</p>
              </Card>
              <Card className="text-center py-4">
                <p className="text-muted-foreground text-xs mb-1">Sources Found</p>
                <p className="text-2xl font-bold text-primary">{result.stats?.sourcesFound || 0}</p>
              </Card>
              <Card className="text-center py-4">
                <p className="text-muted-foreground text-xs mb-1">Topics Found</p>
                <p className="text-2xl font-bold text-success">{result.stats?.topicsIdentified || 0}</p>
              </Card>
              <Card className="text-center py-4 cursor-pointer hover:border-primary/50 transition-colors border-primary/30 bg-primary/5"
                onClick={goToInterview}>
                <p className="text-primary text-xs mb-1 font-medium">Use for Interview</p>
                <ArrowRight className="w-6 h-6 text-primary mx-auto" />
              </Card>
            </div>

            {/* Title + summary */}
            <Card>
              <h2 className="text-xl font-bold text-foreground mb-2">{result.title}</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">{result.summary}</p>
              {result.salary_range && (
                <span className="inline-block mt-3 px-3 py-1 bg-success/15 text-success border border-success/30 rounded-full text-xs font-medium">
                  💰 {result.salary_range}
                </span>
              )}
            </Card>

            {/* Key findings */}
            {result.insights?.key_findings?.length > 0 && (
              <Card>
                <h3 className="text-sm font-semibold text-success mb-3">Key Findings</h3>
                <div className="space-y-2">
                  {result.insights.key_findings.map((f, i) => (
                    <div key={i} className="flex gap-2.5 text-sm text-foreground/90">
                      <span className="text-success flex-shrink-0 mt-0.5">→</span> {f}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Company patterns (for Agent 2 transparency) */}
            {result.companyPatterns?.focus_topics?.length > 0 && (
              <Card>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-primary">Interview Patterns</h3>
                  <Badge variant="default">Used by Interview Agent</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">FOCUS TOPICS</p>
                    <div className="flex flex-wrap gap-1.5">
                      {result.companyPatterns.focus_topics.map((t, i) => (
                        <span key={i} className="px-2.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs">{t}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">INTERVIEW ROUNDS</p>
                    {result.companyPatterns.interview_rounds?.map((r, i) => (
                      <p key={i} className="text-xs text-foreground/80 mb-0.5">• {r}</p>
                    ))}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">DIFFICULTY</p>
                    <Badge variant={result.companyPatterns.difficulty_level === "Hard" ? "danger" : result.companyPatterns.difficulty_level === "Medium" ? "warning" : "success"}>
                      {result.companyPatterns.difficulty_level}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">COMMONLY ASKED</p>
                    {result.companyPatterns.commonly_asked?.slice(0, 3).map((c, i) => (
                      <p key={i} className="text-xs text-foreground/80 mb-0.5">• {c}</p>
                    ))}
                  </div>
                </div>
              </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Skills */}
              {result.insights?.skills_required?.length > 0 && (
                <Card>
                  <h3 className="text-xs font-semibold text-muted-foreground mb-2.5">SKILLS REQUIRED</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {result.insights.skills_required.map((s, i) => (
                      <span key={i} className="px-2.5 py-0.5 bg-secondary border border-border rounded-full text-xs text-foreground/80">{s}</span>
                    ))}
                  </div>
                </Card>
              )}
              {/* Interview tips */}
              {result.insights?.interview_tips?.length > 0 && (
                <Card>
                  <h3 className="text-xs font-semibold text-warning mb-2.5">INTERVIEW TIPS</h3>
                  {result.insights.interview_tips.slice(0, 4).map((t, i) => (
                    <p key={i} className="text-xs text-foreground/80 mb-1.5 flex gap-1.5"><span className="text-warning">•</span>{t}</p>
                  ))}
                </Card>
              )}
              {/* Patterns */}
              {result.insights?.patterns?.length > 0 && (
                <Card>
                  <h3 className="text-xs font-semibold text-muted-foreground mb-2.5">PATTERNS</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {result.insights.patterns.map((p, i) => (
                      <span key={i} className="px-2.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs">{p}</span>
                    ))}
                  </div>
                </Card>
              )}
            </div>

            {/* Roadmap */}
            {result.roadmap?.length > 0 && (
              <Card>
                <h3 className="text-sm font-semibold text-foreground mb-3">Preparation Roadmap</h3>
                <div className="space-y-2">
                  {result.roadmap.map((step, i) => (
                    <div key={i} className="flex gap-3 items-start">
                      <span className="w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                      <span className="text-sm text-foreground/90 leading-relaxed pt-0.5">{step}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Action plan */}
            {result.action_plan?.length > 0 && (
              <Card>
                <h3 className="text-sm font-semibold text-foreground mb-3">Action Plan</h3>
                <div className="space-y-3">
                  {result.action_plan.map((a, i) => {
                    const labels = ["This Week", "This Month", "In 3 Months"];
                    const variants = ["success", "default", "warning"];
                    return (
                      <div key={i} className="flex gap-3 items-start">
                        <Badge variant={variants[i]}>{labels[i] || `Step ${i + 1}`}</Badge>
                        <span className="text-sm text-foreground/90 leading-relaxed pt-0.5">{a}</span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* Resources */}
            {result.resources?.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">Learning Resources</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {result.resources.map((r, i) => (
                    <Card key={i} className="p-4">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-sm font-medium text-foreground">{r.name}</span>
                        <Badge variant="muted">{r.type}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2 leading-relaxed">{r.description}</p>
                      {r.url && <a href={r.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">Visit →</a>}
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Agent reasoning */}
            {result.insights?.reasoning && (
              <Card>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">Agent Reasoning</h3>
                <p className="text-sm text-muted-foreground leading-relaxed italic">{result.insights.reasoning}</p>
              </Card>
            )}

            {/* CTA */}
            <div className="flex gap-3">
              <button onClick={goToInterview}
                className="flex-1 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
                Use for Mock Interview <ArrowRight className="w-4 h-4" />
              </button>
              <button onClick={reset}
                className="px-6 py-3 border border-border rounded-lg text-muted-foreground hover:border-primary/40 transition-colors flex items-center gap-2">
                <RotateCcw className="w-4 h-4" /> New Research
              </button>
            </div>
          </div>
        )}

        {/* ── History ───────────────────────────────────── */}
        {stage === "idle" && history.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">Past Research</h3>
            {history.map((h) => (
              <Card key={h._id} className="flex items-center justify-between py-4 cursor-pointer hover:border-primary/40 transition-colors"
                onClick={() => { setInput(h.query); setType(h.type || "Company Research"); }}>
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{h.query}</p>
                    <p className="text-xs text-muted-foreground">{h.type} · {new Date(h.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                {h.report?.stats?.searchesPerformed && (
                  <span className="text-xs text-muted-foreground">{h.report.stats.searchesPerformed} searches</span>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
