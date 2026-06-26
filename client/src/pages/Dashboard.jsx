import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Search, Mic, Map, UploadCloud, CheckCircle2, ArrowRight } from "lucide-react";
import { analyzeResume, getHistory, getResearchHistory, getInterviews, getRoadmaps } from "../services/api.js";
import DashboardLayout from "../components/DashboardLayout.jsx";
import { Card, Badge, Spinner } from "../components/ui.jsx";

const QUICK_LINKS = [
  { label: "Research Companies", desc: "Interview prep & job info", path: "/research", icon: Search },
  { label: "Mock Interview", desc: "Practice with AI interviewer", path: "/interview", icon: Mic },
  { label: "DSA Roadmap", desc: "Personalized study plan", path: "/roadmap", icon: Map },
];

export default function Dashboard() {
  const [file, setFile] = useState(null);
  const [jobRole, setJobRole] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);
  const [counts, setCounts] = useState({ research: null, interviews: null, roadmaps: null });
  const [drag, setDrag] = useState(false);
  const fileRef = useRef();
  const navigate = useNavigate();

  useEffect(() => {
    getHistory().then((r) => setHistory(r.data)).catch(() => {});
    getResearchHistory().then((r) => setCounts((c) => ({ ...c, research: r.data.length }))).catch(() => {});
    getInterviews().then((r) => setCounts((c) => ({ ...c, interviews: r.data.length }))).catch(() => {});
    getRoadmaps().then((r) => setCounts((c) => ({ ...c, roadmaps: r.data.length }))).catch(() => {});
  }, []);

  const handleFile = (f) => {
    if (f && f.type === "application/pdf") {
      setFile(f);
      setError("");
    } else setError("Please upload a PDF file.");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return setError("Please upload your resume PDF.");
    setLoading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("resume", file);
      fd.append("jobRole", jobRole);
      const { data } = await analyzeResume(fd);
      navigate(`/results/${data.analysisId}`);
    } catch (err) {
      setError(err.response?.data?.message || "Analysis failed. Check your API key.");
    } finally {
      setLoading(false);
    }
  };

  const latestScore = history[0]?.result?.ats_score;
  const scoreColor = (s) => (s >= 75 ? "success" : s >= 50 ? "warning" : "danger");

  const kpis = [
    { label: "Resumes Analyzed", value: history.length || "0" },
    { label: "Latest ATS Score", value: latestScore != null ? `${latestScore}` : "—", badge: latestScore != null ? { v: scoreColor(latestScore), t: latestScore >= 75 ? "Excellent" : latestScore >= 50 ? "Good" : "Needs work" } : null },
    { label: "Research Reports", value: counts.research ?? "…" },
    { label: "Roadmaps Generated", value: counts.roadmaps ?? "…" },
  ];

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8 max-w-6xl">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-1">Analyze your resume with AI</h1>
          <p className="text-muted-foreground">Get an ATS score, skill gaps, and personalized improvements in seconds</p>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {kpis.map((k) => (
            <Card key={k.label}>
              <div className="space-y-3">
                <span className="text-sm font-medium text-muted-foreground">{k.label}</span>
                <div className="text-4xl font-bold text-foreground">{k.value}</div>
                {k.badge && <Badge variant={k.badge.v}>{k.badge.t}</Badge>}
              </div>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upload + history */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div
                  onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                  onDragLeave={() => setDrag(false)}
                  onDrop={(e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}
                  onClick={() => fileRef.current.click()}
                  className={`border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
                    drag ? "border-primary bg-primary/5" : file ? "border-success/60 bg-success/5" : "border-border hover:border-primary/50"
                  }`}
                >
                  <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
                  {file ? <CheckCircle2 className="w-10 h-10 text-success mb-3" /> : <UploadCloud className="w-10 h-10 text-muted-foreground mb-3" />}
                  <p className="text-foreground font-medium mb-1">{file ? file.name : "Drop your resume here"}</p>
                  <p className="text-sm text-muted-foreground">{file ? "Click to choose a different file" : "or click to browse — PDF only, max 5MB"}</p>
                </div>

                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">
                    Target Job Role <span className="text-muted-foreground/60">(optional — improves analysis)</span>
                  </label>
                  <input
                    value={jobRole}
                    onChange={(e) => setJobRole(e.target.value)}
                    placeholder="e.g. SDE Intern, Full Stack Developer, Backend Engineer"
                    className="w-full px-3 py-2.5 bg-input border border-border rounded-lg text-foreground placeholder-muted-foreground text-sm focus:border-primary transition-colors"
                  />
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <button
                  className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  disabled={loading || !file}
                >
                  {loading ? (
                    <>
                      <Spinner /> Analyzing your resume...
                    </>
                  ) : (
                    <>
                      Analyze Resume <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </Card>

            {history.length > 0 && (
              <Card>
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground">Previous Analyses</h3>
                  <div className="space-y-2">
                    {history.map((a) => (
                      <div
                        key={a._id}
                        onClick={() => navigate(`/results/${a._id}`)}
                        className="flex items-center justify-between p-3 bg-secondary rounded-lg hover:bg-secondary/80 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{a.fileName || "Resume"}</p>
                            <p className="text-xs text-muted-foreground">
                              {a.jobRole || "General analysis"} · {new Date(a.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <Badge variant={scoreColor(a.result?.ats_score)}>{a.result?.ats_score}/100</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* Quick actions */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">Quick Actions</h3>
            {QUICK_LINKS.map(({ label, desc, path, icon: Icon }) => (
              <Card
                key={path}
                onClick={() => navigate(path)}
                className="cursor-pointer hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
