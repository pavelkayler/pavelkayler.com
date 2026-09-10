import assert from 'node:assert/strict'
import test from 'node:test'
import { loadingPercent } from '../src/app/loadingProgress.ts'

test('shows completed resources as a percentage, not an elapsed-time counter', () => {
  assert.equal(loadingPercent(0, 23), 0)
  assert.equal(loadingPercent(1, 23), 4)
  assert.equal(loadingPercent(12, 23), 52)
  assert.equal(loadingPercent(22, 23), 95)
})
test('100 is reserved for confirmed completion, including the painted page', () => {
  assert.equal(loadingPercent(23, 23), 99)
  assert.equal(loadingPercent(23, 23, true), 100)
  assert.equal(loadingPercent(22, 23, false), 95)
})
test('guards unknown totals and invalid inputs', () => {
  for (const [ready, total] of [[0, 0], [3, 0], [NaN, 20], [2, Infinity], [-1, 20]]) {
    assert.equal(loadingPercent(ready, total), 0)
  }
  assert.equal(loadingPercent(40, 23), 99)
})
