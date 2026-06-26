// Shared visual primitives — ported from the dashboard redesign system.
export function Card({ children, className = "", ...props }) {
  return (
    <div className={`bg-card border border-border rounded-lg p-6 ${className}`} {...props}>
      {children}
    </div>
  );
}

const BADGE_VARIANTS = {
  success: "bg-success/15 text-success border border-success/30",
  warning: "bg-warning/15 text-warning border border-warning/30",
  danger: "bg-destructive/15 text-destructive border border-destructive/30",
  default: "bg-primary/15 text-primary border border-primary/30",
  muted: "bg-muted/40 text-muted-foreground border border-border",
};

export function Badge({ children, variant = "default", className = "" }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${BADGE_VARIANTS[variant]} ${className}`}>
      {children}
    </span>
  );
}

const PROGRESS_COLORS = {
  blue: "bg-primary",
  green: "bg-success",
  orange: "bg-warning",
  red: "bg-destructive",
};

export function ProgressBar({ value, max = 100, color = "blue", showLabel = true, className = "" }) {
  const percentage = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={`space-y-2 ${className}`}>
      {showLabel && (
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-foreground">{percentage.toFixed(0)}%</span>
        </div>
      )}
      <div className="w-full h-2 bg-muted/40 rounded-full overflow-hidden">
        <div className={`h-full ${PROGRESS_COLORS[color]} rounded-full transition-all duration-500`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

export function Spinner({ className = "w-5 h-5" }) {
  return (
    <span
      className={`inline-block border-2 border-white/30 border-t-white rounded-full animate-spin-slow ${className}`}
    />
  );
}

export function Tag({ children, className = "" }) {
  return (
    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium bg-secondary border border-border text-muted-foreground ${className}`}>
      {children}
    </span>
  );
}
