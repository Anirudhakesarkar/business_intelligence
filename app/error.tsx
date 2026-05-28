'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 px-4 text-slate-100">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500"
      >
        Try again
      </button>
    </div>
  );
}
