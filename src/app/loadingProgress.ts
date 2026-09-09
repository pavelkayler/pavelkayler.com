/** Percentage of ready resources, not a timer or a claim of transferred bytes.
 * Keep 100% for the completed gate, including its final decode/paint work.
 */
export function loadingPercent(ready: number, total: number, complete = false): number {
  if (complete) return 100
  if (!Number.isFinite(ready) || !Number.isFinite(total) || total <= 0) return 0
  return Math.max(0, Math.min(99, Math.floor(ready * 100 / total)))
}
