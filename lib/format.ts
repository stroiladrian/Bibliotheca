/** "16 h 31 min", "37 min", "45 s" */
export function duration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return m ? `${h} h ${m} min` : `${h} h`;
  if (m > 0) return `${m} min`;
  return `${s} s`;
}

/** "1:02:05" or "14:08" for the player clock. */
export function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** Romanian plural agreement: 1 capitol, 2 capitole, 20 de capitole. */
export function plural(n: number, one: string, few: string): string {
  const rest = n % 100;
  const de = rest >= 20 || (n >= 100 && rest === 0) ? "de " : "";
  return n === 1 ? `1 ${one}` : `${n} ${de}${few}`;
}

export function megabytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1).replace(".", ",")} GB`;
}

export function estimateBytes(seconds: number, kbps: number): number {
  return Math.round((seconds * kbps * 1000) / 8);
}

export function voiceLabel(narration: "human" | "ai"): string {
  return narration === "ai" ? "Voce AI" : "Voce umană · LibriVox";
}
