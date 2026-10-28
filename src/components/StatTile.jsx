export default function StatTile({ icon, label, value, tone = 'blue' }) {
  const tones = {
    blue: 'bg-brand-soft text-brand',
    green: 'bg-[var(--success-soft)] text-[var(--success)]',
    amber: 'bg-amber-50 text-amber-600',
    slate: 'bg-[var(--fill)] text-[var(--text-muted)]',
  };

  return (
    <div className="gcard flex items-center gap-4 !p-5">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${tones[tone] || tones.blue}`}>
        <i className={icon}></i>
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold text-[var(--text)] leading-tight">{value}</div>
        <div className="text-sm text-[var(--text-muted)] truncate">{label}</div>
      </div>
    </div>
  );
}
