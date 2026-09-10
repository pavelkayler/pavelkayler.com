/** Resource completion, not byte progress. Reserve 100% for the committed, ready UI. */
export function loadingPercent(ready: number, total: number, complete = false): number {
  if (complete) return 100
  if (!Number.isFinite(ready) || !Number.isFinite(total) || total <= 0) return 0
  return Math.max(0, Math.min(99, Math.floor(100 * ready / total)))
}
