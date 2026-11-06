import { useState, useEffect, useRef } from "react";
import { Sparkles, User, Send, Trash2 } from "lucide-react";
import { sendMessage, getChatHistory, clearChat } from "../services/api.js";
import DashboardLayout from "../components/DashboardLayout.jsx";

const SUGGESTIONS = [
  "What skills should I learn next?",
  "Am I ready for TCS interview?",
  "How can I improve my ATS score?",
  "What projects should I build?",
  "Give me a 30-day preparation plan",
  "What are my biggest weaknesses?",
];

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [resumeSummary, setResumeSummary] = useState("");
  const bottomRef = useRef();
  const inputRef = useRef();

  useEffect(() => {
    getChatHistory()
      .then((r) => {
        setMessages(r.data.messages || []);
        setResumeSummary(r.data.resumeSummary || "");
      })
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async (text) => {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: msg, createdAt: new Date() }]);
    setLoading(true);
    try {
      const { data } = await sendMessage({ message: msg });
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply, createdAt: new Date() }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, something went wrong. Try again.", createdAt: new Date() }]);
    } finally { setLoading(false); inputRef.current?.focus(); }
  };

  const handleClear = async () => {
    if (!confirm("Clear all chat history?")) return;
    await clearChat();
    setMessages([]);
  };

  const formatTime = (date) => new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <DashboardLayout>
      <div className="flex" style={{ height: "100vh" }}>
        {/* Resume context sidebar */}
        <div className="w-64 border-r border-border bg-card/40 p-5 flex-shrink-0 overflow-y-auto flex flex-col gap-5">
          <div>
            <div className="text-[11px] font-semibold text-muted-foreground tracking-wider uppercase mb-2.5">AI knows about you</div>
            {resumeSummary ? (
              <div className="text-xs text-foreground/80 leading-relaxed bg-secondary rounded-lg p-3 border border-border">
                {resumeSummary.substring(0, 300)}...
              </div>
            ) : (
              <div className="text-xs text-muted-foreground leading-relaxed">
                No resume analyzed yet. Upload your resume on the dashboard for personalized advice.
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-semibold text-muted-foreground tracking-wider uppercase">Quick Questions</span>
              {messages.length > 0 && (
                <button onClick={handleClear} className="text-muted-foreground hover:text-destructive transition-colors" title="Clear chat">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(s)}
                  className="text-left bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-foreground/80 leading-snug hover:border-primary/50 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-8 py-6 flex flex-col gap-5">
            {loadingHistory && <div className="text-center text-muted-foreground text-sm">Loading chat history...</div>}

            {!loadingHistory && messages.length === 0 && (
              <div className="text-center mt-16">
                <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-7 h-7 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  Chat with <span className="text-primary">CareerAI</span>
                </h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  I remember your resume and past conversations.<br />Ask me anything about your career.
                </p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2.5 items-end ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-4 h-4 text-primary-foreground" />
                  </div>
                )}
                <div className="max-w-[70%]">
                  <div
                    className={`px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-2xl rounded-br-md"
                        : "bg-card border border-border text-foreground rounded-2xl rounded-bl-md"
                    }`}
                  >
                    {msg.content}
                  </div>
                  <div className={`text-[11px] text-muted-foreground mt-1 ${msg.role === "user" ? "text-right" : "text-left"}`}>
                    {msg.createdAt ? formatTime(msg.createdAt) : ""}
                  </div>
                </div>
                {msg.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-2.5 items-end">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-primary-foreground" />
                </div>
                <div className="px-4.5 py-3.5 bg-card border border-border rounded-2xl rounded-bl-md flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full bg-muted-foreground" style={{ animation: `bounce-dot 1s ${i * 0.2}s infinite` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border px-8 py-4 bg-card/40 flex-shrink-0">
            <div className="flex gap-2.5 max-w-3xl mx-auto">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything about your career..."
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                disabled={loading}
                className="flex-1 px-3.5 py-3 bg-input border border-border rounded-lg text-foreground placeholder-muted-foreground text-sm focus:border-primary transition-colors"
              />
              <button
                onClick={() => handleSend()}
                disabled={loading || !input.trim()}
                className="px-6 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <Send className="w-4 h-4" /> Send
              </button>
            </div>
            <p className="text-center text-[11px] text-muted-foreground mt-2">
              AI remembers your resume and this conversation across sessions
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
