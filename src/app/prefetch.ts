// Compatibility with pointer/focus hooks. There is no speculative queue after
// startup anymore: every route's code and resources are already prepared.
export function prefetchRoute(_pathname: string, _mode?: 'intent' | 'idle' | 'background') {}
export function scheduleRouteWarmup(_pathname: string) { return () => undefined }
export function scheduleSiteWarmup(_pathname: string) {}
