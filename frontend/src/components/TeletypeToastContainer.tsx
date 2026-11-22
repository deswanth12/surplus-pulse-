import type { FC } from "react";
import { Radio, X } from "lucide-react";
import { TeletypeToast } from "../types";

interface TeletypeToastContainerProps {
  toasts: TeletypeToast[];
  onDismissToast?: (id: string) => void;
}

export const TeletypeToastContainer: FC<TeletypeToastContainerProps> = ({
  toasts,
  onDismissToast,
}) => {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-14 sm:bottom-16 right-4 sm:right-6 z-50 space-y-2.5 max-w-sm w-[calc(100vw-2rem)] sm:w-auto pointer-events-auto select-none font-body"
      role="region"
      aria-label="Teletype Notifications"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`teletype-toast-enter bg-light-surface-container-lowest text-light-on-surface shadow-lg border rounded-xl p-3.5 text-xs font-label space-y-1.5 transition-all relative ${
            toast.type === "ERROR"
              ? "border-light-error bg-light-error-container text-light-on-error-container"
              : toast.type === "VERIFIED"
              ? "border-light-success/60 bg-light-success-container/30"
              : "border-light-outline-variant/70 bg-light-surface-container-lowest"
          }`}
          role="status"
        >
          <div className="flex items-center justify-between text-[11px] font-bold">
            <span
              className={`flex items-center gap-1.5 ${
                toast.type === "ERROR"
                  ? "text-light-error"
                  : toast.type === "VERIFIED"
                  ? "text-light-success"
                  : "text-light-primary"
              }`}
            >
              <Radio className="h-3.5 w-3.5 animate-pulse" aria-hidden="true" />
              <span>
                {toast.type === "ERROR"
                  ? "[TELEMETRY ALERT // ERROR]"
                  : "[TELEMETRY DISPATCH STREAM]"}
              </span>
            </span>
            <div className="flex items-center gap-2 text-light-on-surface-variant">
              <span className="tabular-nums text-[10px]">{toast.timestamp}</span>
              {onDismissToast && (
                <button
                  onClick={() => onDismissToast(toast.id)}
                  className="text-light-on-surface-variant hover:text-light-on-surface p-0.5 rounded cursor-pointer transition-colors"
                  aria-label="Dismiss toast"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
          <p className="font-semibold leading-snug">
            {toast.message}
          </p>
        </div>
      ))}
    </div>
  );
};
