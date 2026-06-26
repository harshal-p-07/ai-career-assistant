import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Mic, MicOff, Volume2, Send, RotateCcw, ArrowRight, Brain, Target, TrendingUp } from "lucide-react";
import { startInterview, sendAnswer, getInterviews, getHistory } from "../services/api.js";
import DashboardLayout from "../components/DashboardLayout.jsx";
import { Card, Spinner, Badge } from "../components/ui.jsx";

// ── Voice helpers ──────────────────────────────────────────
function speak(text, onEnd) {
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.95; u.pitch = 1; u.volume = 1;
  const voices = window.speechSynthesis.getVoices();
  const v = voices.find((v) => v.name.includes("Google") || v.lang === "en-US");
  if (v) u.voice = v;
  if (onEnd) u.onend = onEnd;
  window.speechSynthesis.speak(u);
}
function stopSpeaking() { window.speechSynthesis.cancel(); }
function createRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  const r = new SR(); r.continuous = true; r.interimResults = true; r.lang = "en-US";
  return r;
}

const scoreColorClass = (s) => s >= 8 ? "text-success" : s >= 6 ? "text-warning" : "text-destructive";
const scoreBadge      = (s) => s >= 8 ? "success"      : s >= 6 ? "warning"      : "danger";

export default function Interview() {
  const [stage, setStage] = useState("setup");  // setup | loading | active | complete
  const [jobRole, setJobRole] = useState("");
  const [company, setCompany] = useState("");
  const [analysisId, setAnalysisId] = useState("");
  const [analyses, setAnalyses] = useState([]);
  const [interviewId, setInterviewId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [overallScore, setOverallScore] = useState(null);
  const [history, setHistory] = useState([]);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [agentContext, setAgentContext] = useState(null); // Step 1+2 data from backend
  const [researchId, setResearchId]   = useState(null);
  const [loadingStep, setLoadingStep] = useState("");     // what step is running
  const [voiceSupported] = useState(() => !!(window.SpeechRecognition || window.webkitSpeechRecognition));
  const bottomRef = useRef();
  const recognitionRef = useRef(null);
  const navigate = useNavigate();
  const location  = useLocation();

  useEffect(() => {
    getHistory().then((r) => setAnalyses(r.data)).catch(() => {});
    // Pre-fill from Research Agent "Use for Interview" button
    const s = location.state;
    if (s?.researchId) {
      setResearchId(s.researchId);
      if (s.company) setCompany(s.company);
      if (s.jobRole) setJobRole(s.jobRole);
    }
    getInterviews().then((r) => setHistory(r.data)).catch(() => {});
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    return () => { stopSpeaking(); recognitionRef.current?.stop(); };
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  useEffect(() => {
    if (!voiceEnabled || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.role === "ai" && !last.score) { // don't re-speak feedback messages
      setIsSpeaking(true);
      speak(last.content, () => setIsSpeaking(false));
    }
  }, [messages, voiceEnabled]);

  const startListening = () => {
    const rec = createRecognition(); if (!rec) return;
    recognitionRef.current = rec;
    rec.onresult = (e) => {
      let interim = "", final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      if (final) setAnswer((prev) => prev + final);
      setInterimText(interim);
    };
    rec.onend = () => { setIsListening(false); setInterimText(""); };
    rec.onerror = () => { setIsListening(false); setInterimText(""); };
    rec.start(); setIsListening(true);
  };

  const stopListening = () => { recognitionRef.current?.stop(); setIsListening(false); setInterimText(""); };
  const toggleListening = () => { if (isListening) stopListening(); else { stopSpeaking(); setIsSpeaking(false); startListening(); } };

  const handleStart = async (e) => {
    e.preventDefault();
    if (!jobRole.trim()) return setError("Please enter a job role.");
    setError(""); setStage("loading");

    const steps = researchId
      ? [
          "Loading Research Agent data (Step 1 skipped)...",
          "Assessing your skill gaps from resume...",
          "Generating your first adaptive question...",
        ]
      : [
          "Researching company interview patterns...",
          "Assessing your skill gaps...",
          "Generating your first adaptive question...",
        ];
    let si = 0;
    setLoadingStep(steps[0]);
    const stepInterval = setInterval(() => { si = (si + 1) % steps.length; setLoadingStep(steps[si]); }, 3500);

    try {
      const { data } = await startInterview({ jobRole, company, analysisId: analysisId || undefined, researchId: researchId || undefined });
      clearInterval(stepInterval);
      setInterviewId(data.interviewId);
      setAgentContext(data.agentContext);
      setMessages([{ role: "ai", content: data.message, agentMeta: data.agentContext }]);
      setStage("active");
    } catch (err) {
      clearInterval(stepInterval);
      setError(err.response?.data?.message || "Failed to start. Try again.");
      setStage("setup");
    }
  };

  const handleAnswer = async (e) => {
    e?.preventDefault();
    const txt = answer.trim();
    if (!txt || loading) return;
    stopListening(); stopSpeaking();
    setAnswer(""); setInterimText("");
    setMessages((prev) => [...prev, { role: "user", content: txt }]);
    setLoading(true);
    try {
      const { data } = await sendAnswer({ interviewId, answer: txt });
      setMessages((prev) => [...prev, {
        role: "ai",
        content: data.message,
        score: data.score,
        feedback: data.feedback,
        agentReasoning: data.agentReasoning,
        specificMistake: data.specificMistake,
        suggestedImprovement: data.suggestedImprovement,
        adaptDecision: data.adaptDecision,
      }]);
      if (data.isComplete) { setOverallScore(data.overallScore); setStage("complete"); }
    } catch (err) {
      setError(err.response?.data?.message || "Error sending answer.");
    } finally { setLoading(false); }
  };

  const reset = () => {
    stopSpeaking(); stopListening();
    setStage("setup"); setMessages([]); setJobRole(""); setCompany("");
    setOverallScore(null); setAnswer(""); setInterimText(""); setAgentContext(null);
  };

  return (
    <DashboardLayout>
      <div className="p-8 max-w-4xl">

        {/* ── SETUP ──────────────────────────────────────── */}
        {stage === "setup" && (
          <div className="space-y-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-1">Mock Interview</h1>
              <p className="text-muted-foreground">5-step agentic interview — researches your company, assesses gaps, adapts questions in real time</p>
            </div>

            {/* Agent workflow visual */}
            <div className="grid grid-cols-5 gap-2">
              {[
                { n: 1, label: "Research", desc: "Company patterns" },
                { n: 2, label: "Assess",   desc: "Skill gaps" },
                { n: 3, label: "Question", desc: "Adaptive Q" },
                { n: 4, label: "Feedback", desc: "Score + reasons" },
                { n: 5, label: "Adapt",    desc: "Next question" },
              ].map((s) => (
                <div key={s.n} className="text-center">
                  <div className="w-9 h-9 rounded-full bg-primary/15 border border-primary/30 text-primary text-sm font-bold flex items-center justify-center mx-auto mb-1.5">{s.n}</div>
                  <div className="text-xs font-medium text-foreground">{s.label}</div>
                  <div className="text-[10px] text-muted-foreground">{s.desc}</div>
                </div>
              ))}
            </div>

            <Card>
              <form onSubmit={handleStart} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground mb-1.5 block">Target Job Role *</label>
                    <input value={jobRole} onChange={(e) => setJobRole(e.target.value)} placeholder="e.g. Backend Developer, SDE Intern"
                      className="w-full px-3 py-2.5 bg-input border border-border rounded-lg text-foreground placeholder-muted-foreground text-sm focus:border-primary transition-colors" />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1.5 block">Target Company <span className="text-muted-foreground/60">(optional — enables Step 1)</span></label>
                    <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. TCS, Razorpay, Google"
                      className="w-full px-3 py-2.5 bg-input border border-border rounded-lg text-foreground placeholder-muted-foreground text-sm focus:border-primary transition-colors" />
                  </div>
                </div>

                {analyses.length > 0 && (
                  <div>
                    <label className="text-sm text-muted-foreground mb-1.5 block">Base on Resume <span className="text-muted-foreground/60">(enables Step 2 skill gap assessment)</span></label>
                    <select value={analysisId} onChange={(e) => setAnalysisId(e.target.value)}
                      className="w-full px-3 py-2.5 bg-input border border-border rounded-lg text-foreground text-sm focus:border-primary transition-colors">
                      <option value="">No resume — general questions</option>
                      {analyses.map((a) => (
                        <option key={a._id} value={a._id}>{a.fileName || "Resume"} — Score: {a.result?.ats_score}/100</option>
                      ))}
                    </select>
                  </div>
                )}

                {voiceSupported && (
                  <div className="flex items-center justify-between p-4 bg-secondary/50 border border-border rounded-lg">
                    <div>
                      <div className="text-sm font-semibold text-foreground flex items-center gap-1.5"><Volume2 className="w-4 h-4" /> Voice Mode</div>
                      <div className="text-xs text-muted-foreground mt-0.5">AI speaks questions · Answer by voice or text</div>
                    </div>
                    <button type="button" onClick={() => setVoiceEnabled((v) => !v)}
                      className={`w-11 h-6 rounded-full relative transition-colors flex-shrink-0 ${voiceEnabled ? "bg-primary" : "bg-muted/50"}`}>
                      <span className={`absolute top-[3px] rounded-full bg-white transition-all`}
                        style={{ width: 18, height: 18, left: voiceEnabled ? 20 : 3 }} />
                    </button>
                  </div>
                )}

                {/* Research Agent handoff banner */}
                {researchId && (
                  <div className="flex items-center gap-2 p-3 bg-success/10 border border-success/25 rounded-lg">
                    <span className="w-2 h-2 rounded-full bg-success flex-shrink-0" />
                    <p className="text-xs text-success font-medium">
                      Research Agent output loaded — Interview Agent will skip Step 1 and use your research data directly
                    </p>
                    <button type="button" onClick={() => setResearchId(null)}
                      className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
                      ✕
                    </button>
                  </div>
                )}

                {error && <p className="text-sm text-destructive">{error}</p>}
                <button className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2" disabled={!jobRole.trim()}>
                  Start Agentic Interview <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </Card>

            {history.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-foreground">Past Interviews</h3>
                {history.map((h) => (
                  <Card key={h._id} className="flex items-center justify-between py-4">
                    <div>
                      <div className="text-sm font-medium text-foreground">{h.jobRole} {h.company && `@ ${h.company}`}</div>
                      <div className="text-xs text-muted-foreground">{new Date(h.createdAt).toLocaleDateString()} · {h.status}</div>
                    </div>
                    {h.overallScore != null && (
                      <span className={`text-base font-bold ${scoreColorClass(h.overallScore / 10)}`}>{h.overallScore}%</span>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── LOADING (Steps 1-3 running) ─────────────────── */}
        {stage === "loading" && (
          <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center">
              <Brain className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground mb-2">Agent is preparing your interview</h2>
              <p className="text-sm text-primary animate-pulse-soft">{loadingStep}</p>
            </div>
            <div className="flex gap-3 mt-2">
              {["Research", "Assess", "Generate"].map((s, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/50" style={{ animation: `bounce-dot 1s ${i * 0.3}s infinite` }} />
                  {s}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ACTIVE / COMPLETE ───────────────────────────── */}
        {(stage === "active" || stage === "complete") && (
          <div className="flex flex-col" style={{ height: "calc(100vh - 64px)" }}>

            {/* Header with agent context */}
            <div className="flex items-center justify-between mb-3 pt-2 flex-wrap gap-2">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  {jobRole} {company && <span className="text-muted-foreground">@ {company}</span>}
                </h2>
                {agentContext?.assessment && (
                  <div className="flex gap-2 mt-1 flex-wrap">
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/20">
                      Readiness: {agentContext.assessment.readiness_score}%
                    </span>
                    {agentContext.assessment.weak_areas?.slice(0, 2).map((w) => (
                      <span key={w} className="text-[11px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
                        Gap: {w}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isSpeaking && <span className="text-xs text-primary flex items-center gap-1"><Volume2 className="w-3 h-3" /> Speaking...</span>}
                {voiceSupported && (
                  <button onClick={() => { setVoiceEnabled((v) => !v); if (isSpeaking) { stopSpeaking(); setIsSpeaking(false); } }}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors flex items-center gap-1.5 ${voiceEnabled ? "text-primary border-primary/40 bg-primary/10" : "text-muted-foreground border-border"}`}>
                    {voiceEnabled ? <Volume2 className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
                    {voiceEnabled ? "Voice On" : "Voice Off"}
                  </button>
                )}
                {stage === "complete" && overallScore != null && (
                  <span className={`text-xl font-bold ${scoreColorClass(overallScore / 10)}`}>{overallScore}%</span>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto flex flex-col gap-4 pr-1">
              {messages.map((msg, i) => (
                <div key={i}>
                  <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-2xl rounded-br-md"
                        : "bg-card border border-border text-foreground rounded-2xl rounded-bl-md"
                    }`}>
                      {msg.content}
                    </div>
                  </div>

                  {/* Agent metadata panel — shown under AI messages that have score */}
                  {msg.role === "ai" && msg.score != null && (
                    <div className="ml-1 mt-2 space-y-1.5">
                      <div className="flex gap-2 flex-wrap items-center">
                        <Badge variant={scoreBadge(msg.score)}>Score: {msg.score}/10</Badge>
                        {msg.adaptDecision?.difficultyAdjustment && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" /> {msg.adaptDecision.difficultyAdjustment} → {msg.adaptDecision.nextTopic}
                          </span>
                        )}
                      </div>
                      {msg.feedback && <p className="text-xs text-muted-foreground">{msg.feedback}</p>}
                      {msg.specificMistake && (
                        <p className="text-xs text-destructive flex items-start gap-1">
                          <Target className="w-3 h-3 flex-shrink-0 mt-0.5" /> Mistake: {msg.specificMistake}
                        </p>
                      )}
                      {msg.suggestedImprovement && (
                        <p className="text-xs text-success">→ {msg.suggestedImprovement}</p>
                      )}
                      {msg.agentReasoning && (
                        <p className="text-[11px] text-muted-foreground/70 italic">Agent: {msg.agentReasoning}</p>
                      )}
                    </div>
                  )}

                  {/* Topic badge under AI questions (no score) */}
                  {msg.role === "ai" && !msg.score && msg.agentMeta?.topicChosen && (
                    <div className="ml-1 mt-1.5">
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                        Topic: {msg.agentMeta.topicChosen}
                      </span>
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex gap-1.5 px-4 py-3 bg-card border border-border rounded-2xl rounded-bl-md w-fit">
                  {[0,1,2].map((i) => (
                    <span key={i} className="w-2 h-2 rounded-full bg-muted-foreground"
                      style={{ animation: `bounce-dot 1s ${i * 0.2}s infinite` }} />
                  ))}
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            {stage === "active" && (
              <div className="mt-4 flex-shrink-0">
                {interimText && (
                  <div className="px-3.5 py-2 mb-2 bg-primary/5 border border-primary/20 rounded-lg text-sm text-muted-foreground italic">{interimText}</div>
                )}
                {error && <p className="text-sm text-destructive mb-2">{error}</p>}
                <form onSubmit={handleAnswer} className="flex gap-2.5">
                  <input value={answer} onChange={(e) => setAnswer(e.target.value)}
                    placeholder={isListening ? "Listening..." : "Type your answer or use mic"}
                    disabled={loading}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleAnswer(e)}
                    className={`flex-1 px-3.5 py-3 bg-input border rounded-lg text-foreground placeholder-muted-foreground text-sm transition-colors ${isListening ? "border-primary" : "border-border focus:border-primary"}`} />
                  {voiceSupported && (
                    <button type="button" onClick={toggleListening} disabled={loading}
                      className={`px-4 rounded-lg border-2 transition-colors flex items-center justify-center ${isListening ? "border-primary bg-primary/15 text-primary" : "border-border bg-secondary text-muted-foreground"}`}
                      style={isListening ? { animation: "glow 1.5s ease infinite" } : undefined}>
                      {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </button>
                  )}
                  <button className="px-6 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                    disabled={loading || !answer.trim()}>
                    <Send className="w-4 h-4" /> Send
                  </button>
                </form>
                {isListening && <p className="text-center text-xs text-primary mt-2">Listening — speak clearly, then click Send</p>}
              </div>
            )}

            {stage === "complete" && (
              <div className="mt-4 flex gap-3 flex-shrink-0">
                <button onClick={reset} className="flex-1 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
                  <RotateCcw className="w-4 h-4" /> Start New Interview
                </button>
                <button onClick={() => navigate("/")} className="px-6 py-3 border border-border rounded-lg text-muted-foreground hover:border-primary/40 transition-colors">
                  Dashboard
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
