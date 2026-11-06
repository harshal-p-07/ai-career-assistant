import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { getAnalysis } from "../services/api.js";
import DashboardLayout from "../components/DashboardLayout.jsx";
import { Card, Tag, Spinner } from "../components/ui.jsx";

export default function Results() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAnalysis(id)
      .then((r) => setData(r.data))
      .catch(() => navigate("/"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Spinner className="w-10 h-10 border-[3px] mx-auto" />
            <p className="mt-4 text-muted-foreground">Loading your analysis...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const r = data?.result;
  if (!r) return null;

  const scoreHex = r.ats_score >= 75 ? "var(--success)" : r.ats_score >= 50 ? "var(--warning)" : "var(--destructive)";
  const circumference = 2 * Math.PI * 80;
  const dashOffset = circumference - (r.ats_score / 100) * circumference;

  return (
    <DashboardLayout>
      <div className="p-8 max-w-5xl space-y-6">
        <button
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to dashboard
        </button>

        <div>
          <p className="text-xs text-muted-foreground mb-2">
            {data.fileName} {data.jobRole && `· ${data.jobRole}`}
          </p>
          <h1 className="text-3xl font-bold text-foreground mb-3">Resume Analysis Report</h1>
          <p className="text-muted-foreground leading-relaxed">{r.overall_summary}</p>
        </div>

        {/* Score + action items */}
        <Card className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-8 items-center p-8">
          <div className="relative w-44 h-44 mx-auto">
            <svg width="176" height="176" className="-rotate-90">
              <circle cx="88" cy="88" r="80" fill="none" stroke="var(--muted)" strokeOpacity="0.3" strokeWidth="12" />
              <circle
                cx="88" cy="88" r="80" fill="none" stroke={scoreHex} strokeWidth="12"
                strokeDasharray={circumference} strokeDashoffset={dashOffset} strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 1.2s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-bold" style={{ color: scoreHex }}>{r.ats_score}</span>
              <span className="text-xs text-muted-foreground">ATS Score</span>
            </div>
          </div>

          <div>
            <div className="flex gap-2 flex-wrap mb-5">
              <Tag className="bg-primary/15 text-primary border-primary/30">{r.experience_level}</Tag>
              {r.top_roles_matched?.map((role) => <Tag key={role}>{role}</Tag>)}
            </div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">Top Action Items</h3>
            <div className="space-y-2">
              {r.action_items?.map((item, i) => (
                <div key={i} className="flex gap-2.5 items-start">
                  <ArrowRight className="w-3.5 h-3.5 text-primary mt-1 flex-shrink-0" />
                  <span className="text-sm text-foreground">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* 3 column grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Card>
            <h3 className="text-sm font-semibold text-success mb-3">Strengths</h3>
            <div className="space-y-2">
              {r.strengths?.map((s, i) => <ListItem key={i} text={s} dotClass="bg-success" />)}
            </div>
          </Card>
          <Card>
            <h3 className="text-sm font-semibold text-warning mb-3">Missing Skills</h3>
            <div className="space-y-2">
              {r.missing_skills?.map((s, i) => <ListItem key={i} text={s} dotClass="bg-warning" />)}
            </div>
          </Card>
          <Card>
            <h3 className="text-sm font-semibold text-primary mb-3">Keywords</h3>
            <div className="mb-3">
              <p className="text-[11px] text-muted-foreground mb-1.5">FOUND</p>
              <div className="flex flex-wrap gap-1.5">
                {r.keywords_found?.slice(0, 8).map((k, i) => (
                  <span key={i} className="text-[11px] px-2.5 py-0.5 rounded-full bg-success/10 text-success border border-success/20">{k}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground mb-1.5">MISSING</p>
              <div className="flex flex-wrap gap-1.5">
                {r.keywords_missing?.slice(0, 8).map((k, i) => (
                  <span key={i} className="text-[11px] px-2.5 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">{k}</span>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Improvements */}
        {r.improvements?.length > 0 && (
          <Card>
            <h3 className="text-sm font-semibold text-foreground mb-4">Detailed Improvements</h3>
            <div className="space-y-4">
              {r.improvements.map((imp, i) => (
                <div key={i} className="border-l-2 border-primary pl-4">
                  <div className="text-xs font-semibold text-primary mb-1 uppercase tracking-wide">{imp.section}</div>
                  <div className="text-sm text-destructive mb-1">Issue: {imp.issue}</div>
                  <div className="text-sm text-success">Fix: {imp.fix}</div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <div className="text-center pt-4">
          <button
            onClick={() => navigate("/")}
            className="px-8 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors inline-flex items-center gap-2"
          >
            Analyze Another Resume <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}

function ListItem({ text, dotClass }) {
  return (
    <div className="flex gap-2 items-start">
      <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${dotClass}`} />
      <span className="text-sm text-foreground leading-relaxed">{text}</span>
    </div>
  );
}
