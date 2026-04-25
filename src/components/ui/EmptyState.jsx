import { ArrowRight } from "lucide-react";

export default function EmptyState({ icon = "📭", title, message, actionLabel, onAction }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white/80 px-6 py-10 text-center shadow-sm">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-3xl">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-bold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm text-slate-500">{message}</p>
      {actionLabel ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-teal px-4 py-2 text-sm font-semibold text-white"
        >
          {actionLabel}
          <ArrowRight className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
