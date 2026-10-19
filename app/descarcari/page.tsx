import type { Metadata } from "next";
import { DownloadsView } from "@/components/DownloadsView";

export const metadata: Metadata = { title: "Descărcări" };

export default function DownloadsPage() {
  return <DownloadsView />;
}
