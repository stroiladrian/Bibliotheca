import Link from "next/link";

export default function NotFound() {
  return (
    <div className="wrap">
      <div className="empty" style={{ marginTop: 60 }}>
        <strong>Pagina asta nu există</strong>
        <span>Poate cartea a fost mutată sau linkul e greșit.</span>
        <Link href="/" className="btn btn-small btn-primary">
          Înapoi acasă
        </Link>
      </div>
    </div>
  );
}
