const RETRY_WHILE_FAILING_MS = 10_000;

/**
 * `refetchInterval` for lists: keep retrying every 10s while the query is in
 * an error state, so the page recovers on its own when the backend is back.
 */
export function retryWhileFailing(query: { state: { status: string } }): number | false {
  return query.state.status === "error" ? RETRY_WHILE_FAILING_MS : false;
}
