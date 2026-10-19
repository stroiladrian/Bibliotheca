import type { Metadata } from "next";
import { LibraryView } from "@/components/LibraryView";

export const metadata: Metadata = { title: "Biblioteca mea" };

export default function LibraryPage() {
  return <LibraryView />;
}
