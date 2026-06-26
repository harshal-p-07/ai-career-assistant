import { useState, useEffect, useRef } from "react";
import { generateRoadmap, getRoadmaps } from "../services/api.js";
import DashboardLayout from "../components/DashboardLayout.jsx";
import { Card, Spinner } from "../components/ui.jsx";

const ALL_COMPANIES = [
  { name: "TCS",               type: "Service"    },
  { name: "Infosys",           type: "Service"    },
  { name: "Wipro",             type: "Service"    },
  { name: "Cognizant",         type: "Service"    },
  { name: "HCL",               type: "Service"    },
  { name: "Tech Mahindra",     type: "Service"    },
  { name: "Capgemini",         type: "Service"    },
  { name: "Accenture",         type: "Service"    },
  { name: "IBM",               type: "Service"    },
  { name: "Mphasis",           type: "Service"    },
  { name: "LTIMindtree",       type: "Service"    },
  { name: "Persistent",        type: "Service"    },
  { name: "Hexaware",          type: "Service"    },
  { name: "Birlasoft",         type: "Service"    },
  { name: "Google",            type: "Product"    },
  { name: "Amazon",            type: "Product"    },
  { name: "Microsoft",         type: "Product"    },
  { name: "Meta",              type: "Product"    },
  { name: "Apple",             type: "Product"    },
  { name: "Netflix",           type: "Product"    },
  { name: "Adobe",             type: "Product"    },
  { name: "Salesforce",        type: "Product"    },
  { name: "Oracle",            type: "Product"    },
  { name: "SAP",               type: "Product"    },
  { name: "Uber",              type: "Product"    },
  { name: "LinkedIn",          type: "Product"    },
  { name: "Atlassian",         type: "Product"    },
  { name: "Nvidia",            type: "Product"    },
  { name: "Flipkart",          type: "Startup"    },
  { name: "Swiggy",            type: "Startup"    },
  { name: "Zomato",            type: "Startup"    },
  { name: "Paytm",             type: "Startup"    },
  { name: "PhonePe",           type: "Startup"    },
  { name: "Razorpay",          type: "Startup"    },
  { name: "CRED",              type: "Startup"    },
  { name: "Zepto",             type: "Startup"    },
  { name: "Groww",             type: "Startup"    },
  { name: "Meesho",            type: "Startup"    },
  { name: "Ola",               type: "Startup"    },
  { name: "Nykaa",             type: "Startup"    },
  { name: "Freshworks",        type: "Startup"    },
  { name: "Zoho",              type: "Startup"    },
  { name: "BrowserStack",      type: "Startup"    },
  { name: "Postman",           type: "Startup"    },
  { name: "InMobi",            type: "Startup"    },
  { name: "Lenskart",          type: "Startup"    },
  { name: "Goldman Sachs",     type: "Fintech"    },
  { name: "JP Morgan",         type: "Fintech"    },
  { name: "Morgan Stanley",    type: "Fintech"    },
  { name: "Deutsche Bank",     type: "Fintech"    },
  { name: "Barclays",          type: "Fintech"    },
  { name: "Visa",              type: "Fintech"    },
  { name: "Mastercard",        type: "Fintech"    },
  { name: "PayPal",            type: "Fintech"    },
  { name: "Deloitte",          type: "Consulting" },
  { name: "PwC",               type: "Consulting" },
  { name: "EY",                type: "Consulting" },
  { name: "KPMG",              type: "Consulting" },
  { name: "Intel",             type: "Hardware"   },
  { name: "Qualcomm",          type: "Hardware"   },
  { name: "Texas Instruments", type: "Hardware"   },
  { name: "Samsung",           type: "Hardware"   },
];

const TYPE_COLOR = {
  Service:    "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Product:    "bg-purple-500/10 text-purple-400 border-purple-500/20",
  Startup:    "bg-orange-500/10 text-orange-400 border-orange-500/20",
  Fintech:    "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  Consulting: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  Hardware:   "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

const LEVELS = ["Beginner (< 50 problems solved)", "Intermediate (50-200 problems)", "Advanced (200+ problems)"];
const WEEKS  = [4, 8, 12, 16, 24];

const PRIORITY_CLASS = {
  High:   "bg-destructive/15 text-destructive border-destructive/30",
  Medium: "bg-warning/15 text-warning border-warning/30",
  Low:    "bg-success/15 text-success border-success/30",
};

function CompanySearch({ value, onChange }) {
  const [query, setQuery]             = useState(value || "");
  const [open, setOpen]               = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef();
  const listRef  = useRef();

  const filtered = query.trim()
    ? ALL_COMPANIES.filter((c) =>
        c.name.toLowerCase().includes(query.toLowerCase()) ||
        c.type.toLowerCase().includes(query.toLowerCase())
      )
    : ALL_COMPANIES;

  const grouped = filtered.reduce((acc, c) => {
    if (!acc[c.type]) acc[c.type] = [];
    acc[c.type].push(c);
    return acc;
  }, {});

  const select = (company) => {
    setQuery(company.name);
    onChange(company.name);
    setOpen(false);
    setHighlighted(0);
  };

  const handleKey = (e) => {
    if (!open) { setOpen(true); return; }
    if (e.key === "ArrowDown")  { e.preventDefault(); setHighlighted((h) => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp")  { e.preventDefault(); setHighlighted((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter")    { e.preventDefault(); if (filtered[highlighted]) select(filtered[highlighted]); }
    else if (e.key === "Escape")   { setOpen(false); }
  };

  useEffect(() => {
    listRef.current?.children[highlighted]?.scrollIntoView({ block: "nearest" });
  }, [highlighted]);

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); onChange(""); setOpen(true); setHighlighted(0); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={handleKey}
          placeholder="Search company... (e.g. Google, TCS, Razorpay)"
          className="w-full px-3 py-2.5 bg-input border border-border rounded-lg text-foreground text-sm focus:border-primary transition-colors pr-8"
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(""); onChange(""); setOpen(true); inputRef.current?.focus(); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-lg leading-none"
          >×</button>
        )}
      </div>

      {value && (
        <div className="mt-1.5 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Selected:</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
            {value}
          </span>
        </div>
      )}

      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-xl max-h-64 overflow-y-auto">
          <div className="sticky top-0 px-3 py-1.5 bg-card border-b border-border text-xs text-muted-foreground">
            <span>{filtered.length} companies</span>
          </div>
          <ul ref={listRef}>
            {query.trim()
              ? filtered.map((c, i) => (
                  <li
                    key={c.name}
                    onMouseDown={() => select(c)}
                    className={`flex items-center justify-between px-3 py-2.5 cursor-pointer transition-colors ${i === highlighted ? "bg-primary/10" : "hover:bg-secondary"}`}
                  >
                    <span className="text-sm text-foreground">{c.name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${TYPE_COLOR[c.type]}`}>{c.type}</span>
                  </li>
                ))
              : Object.entries(grouped).map(([type, companies]) => (
                  <div key={type}>
                    <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-secondary/50">
                      {type}
                    </div>
                    {companies.map((c) => {
                      const idx = filtered.indexOf(c);
                      return (
                        <li
                          key={c.name}
                          onMouseDown={() => select(c)}
                          className={`flex items-center justify-between px-3 py-2.5 cursor-pointer transition-colors ${idx === highlighted ? "bg-primary/10" : "hover:bg-secondary"}`}
                        >
                          <span className="text-sm text-foreground">{c.name}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${TYPE_COLOR[c.type]}`}>{c.type}</span>
                        </li>
                      );
                    })}
                  </div>
                ))
            }
          </ul>
        </div>
      )}

      {open && filtered.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-xl p-4 text-center">
          <p className="text-sm text-muted-foreground">No company found for "{query}"</p>
          <button
            type="button"
            onMouseDown={() => { onChange(query); setOpen(false); }}
            className="mt-2 text-xs px-3 py-1.5 bg-primary/10 text-primary rounded-lg border border-primary/20 hover:bg-primary/20 transition-colors"
          >
            Use "{query}"
          </button>
        </div>
      )}
    </div>
  );
}

export default function Roadmap() {
  const [form, setForm] = useState({ targetCompany: "", targetRole: "Software Engineer", timeframeWeeks: 12, currentLevel: "Beginner (< 50 problems solved)" });
  const [loading, setLoading] = useState(false);
  const [roadmap, setRoadmap] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");
  const [activeWeek, setActiveWeek] = useState(0);

  useEffect(() => { getRoadmaps().then((r) => setHistory(r.data)).catch(() => {}); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.targetCompany) return setError("Please select a target company.");
    setLoading(true); setError(""); setRoadmap(null);
    try {
      const { data } = await generateRoadmap(form);
      setRoadmap(data.roadmap);
      setActiveWeek(0);
    } catch (err) {
      setError(err.response?.data?.message || "Failed. Try again.");
    } finally { setLoading(false); }
  };

  const inputClass = "w-full px-3 py-2.5 bg-input border border-border rounded-lg text-foreground text-sm focus:border-primary transition-colors";

  return (
    <DashboardLayout>
      <div className="p-8 max-w-4xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-1">DSA Roadmap</h1>
          <p className="text-muted-foreground">Personalized study plan based on your target company and timeline</p>
        </div>

        <Card className="max-w-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">

            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Target Company *</label>
              <CompanySearch
                value={form.targetCompany}
                onChange={(val) => setForm({ ...form, targetCompany: val })}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Target Role</label>
                <input value={form.targetRole} onChange={(e) => setForm({ ...form, targetRole: e.target.value })} placeholder="Software Engineer" className={inputClass} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Current Level</label>
                <select value={form.currentLevel} onChange={(e) => setForm({ ...form, currentLevel: e.target.value })} className={inputClass}>
                  {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Timeframe</label>
              <div className="flex gap-2 flex-wrap">
                {WEEKS.map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setForm({ ...form, timeframeWeeks: w })}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      form.timeframeWeeks === w
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary text-muted-foreground border-border hover:border-primary/40"
                    }`}
                  >{w}w</button>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            <button className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2" disabled={loading}>
              {loading && <Spinner />}
              {loading ? "Generating your roadmap..." : "Generate Roadmap"}
            </button>
          </form>
        </Card>

        {roadmap && (
          <div className="space-y-6 fade-up">
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">{roadmap.title}</h2>
              <p className="text-muted-foreground leading-relaxed">{roadmap.overview}</p>
            </div>

            {roadmap.company_pattern && (
              <Card>
                <h3 className="text-base font-semibold text-foreground mb-4">{form.targetCompany} Interview Pattern</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1.5">DIFFICULTY MIX</div>
                    <div className="text-sm text-foreground">{roadmap.company_pattern.difficulty}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1.5">FOCUS AREAS</div>
                    {roadmap.company_pattern.focus_areas?.map((f, i) => <div key={i} className="text-sm text-foreground/90 mb-0.5">{f}</div>)}
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1.5">INTERVIEW ROUNDS</div>
                    {roadmap.company_pattern.interview_rounds?.map((r, i) => <div key={i} className="text-sm text-foreground/90 mb-0.5">{r}</div>)}
                  </div>
                </div>
              </Card>
            )}

            {roadmap.topic_priority?.length > 0 && (
              <div>
                <h3 className="text-base font-semibold text-foreground mb-3">Topic Priority</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {roadmap.topic_priority.map((t, i) => (
                    <div key={i} className="bg-card border border-border rounded-lg px-3.5 py-3 flex justify-between items-center">
                      <div>
                        <div className="text-sm font-medium text-foreground">{t.topic}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{t.problems_recommended} problems</div>
                      </div>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border ${PRIORITY_CLASS[t.priority] || PRIORITY_CLASS.Medium}`}>{t.priority}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {roadmap.weekly_plan?.length > 0 && (
              <div>
                <h3 className="text-base font-semibold text-foreground mb-3">Weekly Plan</h3>
                <div className="flex gap-2 flex-wrap mb-4">
                  {roadmap.weekly_plan.map((w, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveWeek(i)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        activeWeek === i ? "bg-primary text-primary-foreground border-primary" : "bg-secondary text-muted-foreground border-border hover:border-primary/40"
                      }`}
                    >Week {w.week}</button>
                  ))}
                </div>
                {roadmap.weekly_plan[activeWeek] && (
                  <Card>
                    <div className="flex justify-between items-start mb-4 flex-wrap gap-2">
                      <div>
                        <div className="text-lg font-semibold text-foreground">Week {roadmap.weekly_plan[activeWeek].week}: {roadmap.weekly_plan[activeWeek].theme}</div>
                        <div className="text-sm text-muted-foreground mt-1">{roadmap.weekly_plan[activeWeek].goal}</div>
                      </div>
                      <span className="text-xl font-bold text-primary">{roadmap.weekly_plan[activeWeek].problems_count} problems</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <div className="text-xs text-muted-foreground mb-2">TOPICS</div>
                        {roadmap.weekly_plan[activeWeek].topics?.map((t, i) => <div key={i} className="text-sm text-foreground mb-1">{t}</div>)}
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-2">KEY PROBLEMS</div>
                        {roadmap.weekly_plan[activeWeek].key_problems?.map((p, i) => <div key={i} className="text-sm text-primary mb-1">{p}</div>)}
                      </div>
                    </div>
                  </Card>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {roadmap.daily_schedule && (
                <Card>
                  <h3 className="text-base font-semibold text-foreground mb-4">Daily Schedule</h3>
                  <div className="mb-3">
                    <div className="text-xs text-muted-foreground mb-1">WEEKDAYS</div>
                    <div className="text-sm text-foreground/90 leading-relaxed">{roadmap.daily_schedule.weekday}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">WEEKENDS</div>
                    <div className="text-sm text-foreground/90 leading-relaxed">{roadmap.daily_schedule.weekend}</div>
                  </div>
                </Card>
              )}
              <Card>
                <h3 className="text-base font-semibold text-foreground mb-4">Company Tips</h3>
                {roadmap.tips?.map((t, i) => (
                  <div key={i} className="flex gap-2 mb-2.5">
                    <span className="text-sm text-foreground/90 leading-relaxed">{t}</span>
                  </div>
                ))}
              </Card>
            </div>

            {roadmap.resources?.length > 0 && (
              <div>
                <h3 className="text-base font-semibold text-foreground mb-3">Resources</h3>
                <div className="flex gap-2.5 flex-wrap">
                  {roadmap.resources.map((r, i) => (
                    <div key={i} className="bg-card border border-border rounded-lg px-3.5 py-2.5">
                      <div className="text-sm font-medium text-foreground">{r.name}</div>
                      <div className="text-xs text-muted-foreground">{r.type}</div>
                      {r.url && <a href={r.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">Visit</a>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {history.length > 0 && !roadmap && (
          <div className="max-w-2xl">
            <h3 className="text-lg font-semibold text-foreground mb-3">Previous Roadmaps</h3>
            <div className="space-y-2">
              {history.map((h) => (
                <div key={h._id} className="bg-card border border-border rounded-lg px-4 py-3.5 flex justify-between items-center">
                  <div>
                    <div className="text-sm font-medium text-foreground">{h.targetCompany} — {h.targetRole}</div>
                    <div className="text-xs text-muted-foreground">{h.timeframeWeeks} weeks · {new Date(h.createdAt).toLocaleDateString()}</div>
                  </div>
                  <button
                    onClick={() => setForm({ targetCompany: h.targetCompany, targetRole: h.targetRole, timeframeWeeks: h.timeframeWeeks, currentLevel: h.currentLevel })}
                    className="text-xs px-3 py-1.5 border border-border rounded-lg text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                  >Regenerate</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}