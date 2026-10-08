'use client';
import ErrorPage from './error';
import './globals.css';
import './status.css';
export default function GlobalError(props: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <head>
        <title>Page interrupted — AgentGrid</title>
        <meta name="robots" content="noindex, nofollow" />
      </head>
      <body>
        <ErrorPage {...props} />
      </body>
    </html>
  );
}
