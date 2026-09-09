/** A shared, bounded queue. Smaller priority numbers run first. */
export type TaskState = 'queued' | 'running' | 'ready' | 'error'
export interface QueueTask {
  id: string
  priority: number
  state: TaskState
  promise: Promise<void>
  error?: unknown
  run: () => Promise<void>
  operation: () => Promise<void>
  promote?: () => void
}

export class ResourceQueue {
  private tasks = new Map<string, QueueTask>()
  private listeners = new Set<() => void>()
  private active = new Set<QueueTask>()
  private paused = false
  private revision = 0
  private scheduled = false
  readonly foregroundBoundary = 10

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }
  getRevision = () => this.revision
  get = (id: string) => this.tasks.get(id)
  all = () => [...this.tasks.values()]

  private emit() {
    this.revision += 1
    for (const listener of this.listeners) listener()
  }

  setBackgroundPaused(paused: boolean) {
    this.paused = paused
    this.schedule()
  }

  request(id: string, run: () => Promise<void>, priority: number,
          options: { retry?: boolean; refresh?: boolean; promote?: () => void } = {}) {
    const previous = this.tasks.get(id)
    if (previous && !(previous.state === 'error' && options.retry) &&
        !(previous.state === 'ready' && options.refresh)) {
      if (priority < previous.priority) {
        previous.priority = priority
        previous.promote?.()
        this.schedule()
      }
      return previous.promise
    }
    let resolve!: () => void
    let reject!: (error: unknown) => void
    const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no })
    // Speculation has no caller awaiting it. Failures still remain visible/retryable.
    void promise.catch(() => undefined)
    const task: QueueTask = { id, priority, state: 'queued', promise, run, operation: run, promote: options.promote }
    const execute = run
    task.run = async () => {
      try {
        await execute()
        task.state = 'ready'
        resolve()
      } catch (error) {
        task.state = 'error'
        task.error = error
        reject(error)
      }
    }
    this.tasks.set(id, task)
    this.emit()
    this.schedule()
    return promise
  }

  private schedule() {
    if (this.scheduled) return
    this.scheduled = true
    queueMicrotask(() => { this.scheduled = false; this.pump() })
  }

  private pump() {
    // Background work can occupy at most two slots. Two more stay available for
    // a click/startup even when a large speculative download is already running.
    while (this.active.size < 4) {
      const backgroundActive = [...this.active].filter(t => t.priority > this.foregroundBoundary).length
      const next = this.all().filter(t => t.state === 'queued' &&
        (t.priority <= this.foregroundBoundary || (!this.paused && backgroundActive < 2)))
        .sort((a, b) => a.priority - b.priority)[0]
      if (!next) break
      next.state = 'running'
      this.active.add(next)
      this.emit()
      void next.run().finally(() => {
        this.active.delete(next)
        this.emit()
        this.schedule()
      })
    }
  }
}
