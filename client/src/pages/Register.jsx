import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Zap } from "lucide-react";
import { register } from "../services/api.js";
import { Card } from "../components/ui.jsx";

export default function Register() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const { data } = await register(form);
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed.");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="w-full max-w-md p-10">
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Zap className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-foreground">CareerAI</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-1.5">Create account</h1>
        <p className="text-muted-foreground text-sm mb-8">Start analyzing your resume for free</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Full Name</label>
            <input
              placeholder="Enter Your Name" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} required
              className="w-full px-3 py-2.5 bg-input border border-border rounded-lg text-foreground placeholder-muted-foreground text-sm focus:border-primary transition-colors"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Email</label>
            <input
              type="email" placeholder="you@email.com" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} required
              className="w-full px-3 py-2.5 bg-input border border-border rounded-lg text-foreground placeholder-muted-foreground text-sm focus:border-primary transition-colors"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Password</label>
            <input
              type="password" placeholder="Min 6 characters" value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6}
              className="w-full px-3 py-2.5 bg-input border border-border rounded-lg text-foreground placeholder-muted-foreground text-sm focus:border-primary transition-colors"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button className="w-full py-3 mt-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50" disabled={loading}>
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account? <Link to="/login" className="text-primary hover:underline">Sign in</Link>
        </p>
      </Card>
    </div>
  );
}
