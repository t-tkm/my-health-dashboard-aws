import { ReactNode } from 'react';

interface Props {
  label: string;
  value: string;
  color: string;
  sub?: ReactNode;
}

export default function StatCard({ label, value, color, sub }: Props) {
  return (
    <div className="stat-card" style={{ borderColor: color }}>
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color }}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}
