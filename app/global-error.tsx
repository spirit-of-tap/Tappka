"use client";

import posthog from "posthog-js";
import NextError from "next/error";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    posthog.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <NextError statusCode={0} />
        <button
          onClick={reset}
          style={{ position: "fixed", bottom: "1rem", right: "1rem" }}
        >
          Zkusit znovu
        </button>
      </body>
    </html>
  );
}
