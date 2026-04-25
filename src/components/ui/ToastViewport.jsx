import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useAppContext } from "../../context/AppContext";

const TOAST_META = {
  success: {
    icon: CheckCircle2,
    card: "border-emerald-200 bg-emerald-50 text-emerald-800",
    iconTone: "text-emerald-600",
  },
  error: {
    icon: XCircle,
    card: "border-rose-200 bg-rose-50 text-rose-800",
    iconTone: "text-rose-600",
  },
  info: {
    icon: Info,
    card: "border-sky-200 bg-sky-50 text-sky-800",
    iconTone: "text-sky-600",
  },
};

export default function ToastViewport() {
  const { toasts, dismissToast } = useAppContext();

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-[min(92vw,360px)] flex-col gap-3">
      {toasts.map((toast) => {
        const meta = TOAST_META[toast.type] ?? TOAST_META.info;
        const Icon = meta.icon;
        return (
          <div
            key={toast.id}
            className={`pointer-events-auto animate-toast-in rounded-2xl border px-4 py-3 shadow-xl ${meta.card}`}
          >
            <div className="flex items-start gap-3">
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${meta.iconTone}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{toast.title}</p>
                {toast.message ? <p className="mt-1 text-sm opacity-90">{toast.message}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="rounded-lg p-1 opacity-70 transition hover:bg-black/5 hover:opacity-100"
                aria-label="Tutup toast"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
