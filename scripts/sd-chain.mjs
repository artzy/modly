#!/usr/bin/env node
/**
 * Optional CLI: SD WebUI txt2img → save PNG → Modly POST /generate/from-image
 *
 * Usage:
 *   node scripts/sd-chain.mjs --prompt "a red cube" --model-id "your-ext/node-id"
 *
 * Env:
 *   SD_WEBUI_URL   default http://127.0.0.1:7860
 *   MODLY_API_URL  default http://127.0.0.1:8765
 */

import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const SD_URL    = (process.env.SD_WEBUI_URL   ?? 'http://127.0.0.1:7860').replace(/\/+$/, '')
const MODLY_URL = (process.env.MODLY_API_URL  ?? 'http://127.0.0.1:8765').replace(/\/+$/, '')

function arg(name, fallback) {
  const i = process.argv.indexOf(name)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const prompt  = arg('--prompt', 'a simple 3d object on white background')
const modelId = arg('--model-id', '')

if (!modelId) {
  console.error('Required: --model-id <extension-id/node-id>')
  process.exit(1)
}

async function txt2img() {
  const res = await fetch(`${SD_URL}/sdapi/v1/txt2img`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      prompt,
      steps: 20,
      width: 512,
      height: 512,
      cfg_scale: 7,
      sampler_name: 'Euler a',
      seed: -1,
    }),
  })
  if (!res.ok) throw new Error(`SD txt2img HTTP ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const b64 = data.images?.[0]
  if (!b64) throw new Error('No image in SD response')
  const dir = join(tmpdir(), 'modly-sd-chain')
  mkdirSync(dir, { recursive: true })
  const pngPath = join(dir, `sd-${Date.now()}.png`)
  writeFileSync(pngPath, Buffer.from(b64, 'base64'))
  return pngPath
}

async function modlyFromImage(pngPath) {
  const buf = await import('fs').then((fs) => fs.promises.readFile(pngPath))
  const blob = new Blob([buf], { type: 'image/png' })
  const fd = new FormData()
  fd.append('image', blob, 'sd-chain.png')
  fd.append('model_id', modelId)
  fd.append('collection', 'CLI')
  fd.append('remesh', 'none')
  fd.append('enable_texture', 'false')
  fd.append('texture_resolution', '1024')
  fd.append('params', '{}')

  const res = await fetch(`${MODLY_URL}/generate/from-image`, { method: 'POST', body: fd })
  if (!res.ok) throw new Error(`Modly HTTP ${res.status}: ${await res.text()}`)
  const { job_id } = await res.json()
  console.log('job_id:', job_id)

  for (;;) {
    await new Promise((r) => setTimeout(r, 1500))
    const st = await fetch(`${MODLY_URL}/generate/status/${job_id}`)
    const body = await st.json()
    console.log(body.status, body.progress ?? '', body.step ?? '')
    if (body.status === 'done') {
      console.log('output:', body.output_url)
      return
    }
    if (body.status === 'error') throw new Error(body.error ?? 'Modly job failed')
  }
}

try {
  console.log('SD:', SD_URL, 'Modly:', MODLY_URL)
  const png = await txt2img()
  console.log('PNG:', png)
  await modlyFromImage(png)
} catch (err) {
  console.error(err)
  process.exit(1)
}
