type MeterProps = {
  value: number;
  max?: number;
  label: string;
  detail?: string;
  tone?: "default" | "keep" | "drop" | "risk";
};

export function Meter({
  value,
  max = 1,
  label,
  detail,
  tone = "default",
}: MeterProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="meter">
      <div className="meter-meta">
        <span>{label}</span>
        <span>{detail ?? value.toFixed(2)}</span>
      </div>
      <div className="meter-track" aria-hidden="true">
        <div className={`meter-fill ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
