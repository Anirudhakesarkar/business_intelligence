'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100">
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
          <h2 className="text-lg font-semibold">Something went wrong</h2>
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
