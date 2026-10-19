"use client";

import { useEffect, type ReactNode } from "react";
import { PlayerProvider } from "@/lib/player";
import { ToastProvider } from "./Toast";
import { BottomNav, TopBar } from "./Nav";
import { MiniPlayer } from "./MiniPlayer";
import { FullPlayer } from "./FullPlayer";
import { withBase } from "@/lib/base";

function useServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register(withBase("/sw.js")).catch(() => {});
  }, []);
}

export function AppShell({ children }: { children: ReactNode }) {
  useServiceWorker();
  return (
    <ToastProvider>
      <PlayerProvider>
        <TopBar />
        <main className="app-main" id="continut">
          {children}
        </main>
        <MiniPlayer />
        <BottomNav />
        <FullPlayer />
      </PlayerProvider>
    </ToastProvider>
  );
}
