import type { Metadata } from "next";
import { SearchView } from "@/components/SearchView";

export const metadata: Metadata = { title: "Caută" };

export default function SearchPage() {
  return <SearchView />;
}
