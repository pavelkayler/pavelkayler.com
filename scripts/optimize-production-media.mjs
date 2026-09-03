#!/usr/bin/env node
import { readdir, rename, stat, unlink } from 'node:fs/promises'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const ROOT = path.resolve(process.cwd(), 'dist')
const MIN_VIDEO_BYTES = 20 * 1024 * 1024
const MAX_VIDEO_DIMENSION = 1920
const VIDEO_CRF = 20

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', stdio: options.capture ? 'pipe' : 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`${command} failed with exit code ${result.status}${result.stderr ? `: ${result.stderr.trim()}` : ''}`)
  }
  return result.stdout || ''
}

function requireBinary(name) {
  const probe = spawnSync(name, ['-version'], { stdio: 'ignore' })
  if (probe.error || probe.status !== 0) {
    throw new Error(`${name} is required to optimize production media`)
  }
}

async function walk(directory, files = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) await walk(full, files)
    else files.push(full)
  }
  return files
}

function probeVideo(file) {
  const json = run('ffprobe', [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=codec_name,width,height,r_frame_rate,bit_rate',
    '-show_entries', 'format=duration,size,bit_rate',
    '-of', 'json',
    file,
  ], { capture: true })
  return JSON.parse(json)
}

requireBinary('ffmpeg')
requireBinary('ffprobe')

const candidates = []
for (const file of await walk(ROOT)) {
  if (path.extname(file).toLowerCase() !== '.mp4') continue
  const info = await stat(file)
  if (info.size >= MIN_VIDEO_BYTES) candidates.push({ file, size: info.size })
}

if (!candidates.length) {
  console.log('No oversized production MP4 files need optimization.')
  process.exit(0)
}

for (const { file, size: beforeBytes } of candidates) {
  const before = probeVideo(file)
  const temp = `${file}.optimized.mp4`
  const relative = path.relative(ROOT, file)
  console.log(`Optimizing cover video: ${relative}`)
  console.log(`Before: ${(beforeBytes / 1024 / 1024).toFixed(1)} MiB; ${JSON.stringify(before)}`)

  try {
    run('ffmpeg', [
      '-y',
      '-i', file,
      '-map', '0:v:0',
      '-an',
      '-vf', `scale=${MAX_VIDEO_DIMENSION}:${MAX_VIDEO_DIMENSION}:force_original_aspect_ratio=decrease:force_divisible_by=2`,
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', String(VIDEO_CRF),
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      '-map_metadata', '-1',
      temp,
    ])

    const afterBytes = (await stat(temp)).size
    const after = probeVideo(temp)
    if (afterBytes >= beforeBytes) {
      console.log(`Keeping original because optimized output is not smaller (${(afterBytes / 1024 / 1024).toFixed(1)} MiB).`)
      await unlink(temp)
      continue
    }

    await rename(temp, file)
    console.log(`After: ${(afterBytes / 1024 / 1024).toFixed(1)} MiB; saved ${((beforeBytes - afterBytes) / 1024 / 1024).toFixed(1)} MiB; ${JSON.stringify(after)}`)
  } catch (error) {
    await unlink(temp).catch(() => undefined)
    throw error
  }
}
