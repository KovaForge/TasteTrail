"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <main className="page-shell">
          <section className="card stack-md">
            <p className="eyebrow">Application Error</p>
            <h2>TasteTrail hit an unexpected error.</h2>
            <p className="muted">{error.message || "Unknown error"}</p>
            <button onClick={() => reset()}>Try Again</button>
          </section>
        </main>
      </body>
    </html>
  );
}
