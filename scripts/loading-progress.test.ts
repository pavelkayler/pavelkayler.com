import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadingPercent } from '../src/app/loadingProgress.ts'

test('percentage follows actual resource completion', () => {
  assert.equal(loadingPercent(0, 23), 0)
  assert.equal(loadingPercent(1, 23), 4)
  assert.equal(loadingPercent(12, 23), 52)
  assert.equal(loadingPercent(22, 23), 95)
})

test('100 percent is reserved for completed decode/paint gate', () => {
  assert.equal(loadingPercent(23, 23), 99)
  assert.equal(loadingPercent(23, 23, true), 100)
})

test('empty and invalid counts never produce NaN or percentages outside bounds', () => {
  for (const [ready, total] of [[0, 0], [0, -1], [NaN, 23], [1, Infinity]]) {
    assert.equal(loadingPercent(ready, total), 0)
  }
  assert.equal(loadingPercent(-1, 23), 0)
  assert.equal(loadingPercent(100, 23), 99)
})
