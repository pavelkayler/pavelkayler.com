import test from 'node:test'
import assert from 'node:assert/strict'
import { ResourceQueue } from '../src/app/resourceQueue.ts'
const tick = () => new Promise(resolve => setTimeout(resolve, 0))
function latch() { let release!: () => void; const promise = new Promise<void>(yes => { release = yes }); return { promise, release } }

test('duplicate requests share one transfer and priority promotion', async () => {
  const queue = new ResourceQueue(); const gate = latch(); let calls = 0
  const first = queue.request('photo', async () => { calls++; await gate.promise }, 30)
  const second = queue.request('photo', async () => { calls++ }, 0)
  assert.equal(first, second)
  await tick(); assert.equal(calls, 1); assert.equal(queue.get('photo')?.priority, 0)
  gate.release(); await first; assert.equal(queue.get('photo')?.state, 'ready')
})
test('two background slots leave capacity for a navigation', async () => {
  const queue = new ResourceQueue(); const gate = latch(); const started: string[] = []
  const slow = ['one', 'two', 'three'].map(id => queue.request(id, async () => { started.push(id); await gate.promise }, 30))
  await tick(); assert.deepEqual(started, ['one', 'two'])
  await queue.request('clicked', async () => { started.push('clicked') }, 0)
  assert.deepEqual(started, ['one', 'two', 'clicked'])
  gate.release(); await Promise.all(slow)
})
test('paused speculative work does not stop a demanded route', async () => {
  const queue = new ResourceQueue(); const started: string[] = []; queue.setBackgroundPaused(true)
  const background = queue.request('background', async () => { started.push('background') }, 30)
  await queue.request('foreground', async () => { started.push('foreground') }, 0)
  assert.deepEqual(started, ['foreground']); queue.setBackgroundPaused(false); await background
  assert.deepEqual(started, ['foreground', 'background'])
})
test('an error is never ready; retry is explicit and reruns the original operation', async () => {
  const queue = new ResourceQueue(); let attempts = 0
  const operation = async () => { attempts++; if (attempts === 1) throw new Error('offline') }
  await assert.rejects(queue.request('image', operation, 0))
  assert.equal(queue.get('image')?.state, 'error')
  await queue.request('image', queue.get('image')!.operation, 0, { retry: true })
  assert.equal(attempts, 2); assert.equal(queue.get('image')?.state, 'ready')
})
test('all first screens are queued ahead of full galleries and large zoom images', async () => {
  const queue = new ResourceQueue(); const started: string[] = []
  const tasks = [[40, 'zoom'], [30, 'gallery'], [20, 'screen-a'], [20, 'screen-b']].map(([p,id]) =>
    queue.request(String(id), async () => { started.push(String(id)) }, Number(p)))
  await Promise.all(tasks); assert.deepEqual(started, ['screen-a','screen-b','gallery','zoom'])
})
