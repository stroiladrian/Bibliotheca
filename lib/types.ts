export type Narration = "human" | "ai";

/** What the app knows about a book without loading its chapters (data/catalog.json). */
export interface BookLite {
  id: string;
  title: string;
  titleRo?: string;
  author: string;
  authorYears?: string;
  year?: number;
  lang: "en" | "ro";
  narration: Narration;
  /** Original work written for Bibliotheca (not public domain). */
  original?: boolean;
  narrator: string;
  seconds: number;
  chapters: number;
  cover?: string;
  palette?: [string, string];
  cats: string[];
  blurb: string;
  kbps: number;
}

export interface Chapter {
  n: number;
  title: string;
  url: string;
  seconds: number;
}

/** Full book, loaded from /data/books/<id>.json. */
export interface Book extends BookLite {
  about?: string;
  sources: { label: string; url: string }[];
  chapterList: Chapter[];
}

export interface Category {
  key: string;
  title: string;
  subtitle?: string;
}

/** Queued for AI narration, not recorded yet ("În curând"). */
export interface UpcomingBook {
  id: string;
  title: string;
  author: string;
  authorYears?: string;
  year?: number;
  cats: string[];
  blurb: string;
  palette?: [string, string];
  cover?: string;
}

export interface Catalog {
  generatedAt: string;
  categories: Category[];
  featured: string[];
  books: BookLite[];
  upcoming: UpcomingBook[];
}
