import Link from "next/link";
import { BOOKS, CATEGORIES, UPCOMING, categoryBooks, featuredFor, shortBooks } from "@/lib/catalog";
import { Hero } from "@/components/Hero";
import { ContinueRow } from "@/components/ContinueRow";
import { Row } from "@/components/Row";
import { BookTile, UpcomingTile } from "@/components/BookTile";

const ORDER = ["basme", "copii", "scurte", "librivox", "nuvele", "umor", "poezie", "romane", "curand"];

export default function HomePage() {
  const featured = featuredFor(new Date());
  const hours = Math.round(BOOKS.reduce((s, b) => s + b.seconds, 0) / 3600);
  const human = BOOKS.filter((b) => b.narration === "human");

  return (
    <>
      <Hero initialId={featured.id} />

      <div className="wrap home-chips">
        <nav className="chips" aria-label="Categorii">
          <Link href="/" className="chip" aria-current="page">
            Toate
          </Link>
          {CATEGORIES.map((c) => (
            <Link key={c.key} href={`/cauta/?cat=${c.key}`} className="chip">
              {c.title}
            </Link>
          ))}
          <Link href="/cauta/?voice=human" className="chip">
            Voce umană
          </Link>
          <Link href="/cauta/?len=scurte" className="chip">
            Sub 30 min
          </Link>
        </nav>
      </div>

      <ContinueRow />

      {ORDER.map((key) => {
        if (key === "scurte") {
          const shorts = shortBooks();
          if (shorts.length < 2) return null;
          return (
            <Row key={key} title="Pentru o seară" subtitle="Sub o oră, de ascultat dintr-o suflare" href="/cauta/?len=scurte">
              {shorts.map((b) => (
                <BookTile key={b.id} book={b} />
              ))}
            </Row>
          );
        }
        if (key === "librivox") {
          if (!human.length) return null;
          return (
            <Row key={key} title="Citite de oameni" subtitle="Înregistrări LibriVox, făcute de voluntari" href="/cauta/?voice=human">
              {human.map((b) => (
                <BookTile key={b.id} book={b} />
              ))}
            </Row>
          );
        }
        if (key === "curand") {
          if (!UPCOMING.length) return null;
          return (
            <Row key={key} title="În curând" subtitle="Clasici care se înregistrează acum, câte puțin în fiecare zi">
              {UPCOMING.map((b) => (
                <UpcomingTile key={b.id} book={b} />
              ))}
            </Row>
          );
        }
        const cat = CATEGORIES.find((c) => c.key === key);
        if (!cat) return null;
        const books = categoryBooks(key);
        if (!books.length) return null;
        return (
          <Row key={key} title={cat.title} subtitle={cat.subtitle} href={`/cauta/?cat=${key}`}>
            {books.map((b) => (
              <BookTile key={b.id} book={b} />
            ))}
          </Row>
        );
      })}

      <footer className="wrap footer">
        <p>
          <strong>Bibliotheca</strong> are {BOOKS.length} cărți audio în limba română ({hours} ore de ascultare), toate gratuite și
          din domeniul public, plus încă {UPCOMING.length} în curs de înregistrare. Poezia este citită de voluntarii{" "}
          <a href="https://librivox.org" target="_blank" rel="noreferrer">
            LibriVox
          </a>
          . Basmele, nuvelele și romanele sunt luate de pe{" "}
          <a href="https://ro.wikisource.org" target="_blank" rel="noreferrer">
            Wikisource
          </a>{" "}
          și narate cu voci AI (Google Gemini), deci pot apărea mici greșeli de pronunție.
        </p>
        <p>Progresul, lista ta și descărcările rămân doar pe acest dispozitiv.</p>
      </footer>
    </>
  );
}
