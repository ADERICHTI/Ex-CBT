const STYLES = {
  success: { icon: 'fa-circle-check', classes: 'bg-emerald-50 border-emerald-200 text-emerald-800', iconClasses: 'text-emerald-500' },
  warning: { icon: 'fa-triangle-exclamation', classes: 'bg-amber-50 border-amber-200 text-amber-800', iconClasses: 'text-amber-500' },
  info: { icon: 'fa-circle-info', classes: 'bg-brand-soft border-brand-line text-brand-ink', iconClasses: 'text-brand' },
};

export default function Toaster({ toasts, onDismiss }) {
  if (!toasts.length) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
      {toasts.map((t) => {
        const style = STYLES[t.type] ?? STYLES.info;
        return (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-3 border rounded-xl shadow-lg px-4 py-3 text-sm font-medium animate-[toast-in_0.2s_ease-out] ${style.classes}`}
          >
            <i className={`fa-solid ${style.icon} mt-0.5 ${style.iconClasses}`}></i>
            <span className="flex-1 leading-relaxed">{t.message}</span>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              className="opacity-50 hover:opacity-100 transition-opacity"
              aria-label="Dismiss"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        );
      })}
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
