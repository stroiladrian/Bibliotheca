"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

type Toast = (message: string) => void;
const ToastCtx = createContext<Toast>(() => {});

export function useToast(): Toast {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const [key, setKey] = useState(0);
  const timer = useRef<number | undefined>(undefined);

  const show = useCallback<Toast>((m) => {
    window.clearTimeout(timer.current);
    setMessage(m);
    setKey((k) => k + 1);
    timer.current = window.setTimeout(() => setMessage(null), 3200);
  }, []);

  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {message && (
          <div className="toast" key={key}>
            {message}
          </div>
        )}
      </div>
    </ToastCtx.Provider>
  );
}
