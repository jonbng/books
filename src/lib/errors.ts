/**
 * Error helpers — turn thrown errors into something safe to show a reader, and
 * give the app one place to log failures.
 *
 * The service and repo layers throw technical errors (HTTP status codes, SQLite
 * messages) that are great in a log but wrong for a calm reading app. The UI
 * never shows a caught error's raw `.message`; it runs it through
 * {@link toUserMessage}, which recognises the offline case and otherwise returns
 * the caller's own friendly fallback. Validation errors we author ourselves —
 * short, already reader-facing — pass through untouched (see {@link USER_FACING}).
 *
 * Pure module: no React Native imports, so it runs unchanged under `node --test`.
 */

const OFFLINE_MESSAGE = 'No connection. Check your internet and try again.';

const DEFAULT_MESSAGE = 'Something went wrong. Please try again.';

// Short, already reader-facing messages the app throws on purpose (see the db
// repos: "A reading session is already in progress", "No freezes available to
// apply"). These are safe to surface verbatim; anything else is treated as
// technical and replaced with a friendly fallback.
const USER_FACING = [
  'A reading session is already in progress',
  'No freezes available to apply',
];

/**
 * True when an error looks like a failed network request — offline, DNS failure,
 * or a connection that never reached the server. `fetch()` rejects with a
 * `TypeError` ("Network request failed") in these cases, before any HTTP
 * response exists; an HTTP error (4xx/5xx) is a normal `Error` we throw ourselves.
 */
export function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  return err instanceof Error && /network request failed|network error|failed to fetch/i.test(err.message);
}

/**
 * A message safe to show the user. Offline errors get a consistent "no
 * connection" line; messages we authored ourselves pass through; everything
 * else (raw HTTP statuses, native/SQLite errors) is replaced with `fallback`.
 *
 * @param fallback action-specific default, e.g. "Couldn't save your progress."
 */
export function toUserMessage(err: unknown, fallback: string = DEFAULT_MESSAGE): string {
  if (isNetworkError(err)) return OFFLINE_MESSAGE;
  if (err instanceof Error && USER_FACING.includes(err.message)) return err.message;
  return fallback;
}

/**
 * Log a failure with a stable context tag. Quiet in production; in development
 * it surfaces the original error (stack and all) so silent-by-design catches
 * (cache misses, optional widget sync) are still debuggable.
 */
export function logError(context: string, err: unknown): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.error(`[${context}]`, err);
  }
}
