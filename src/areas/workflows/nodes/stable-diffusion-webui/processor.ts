/* eslint-disable @typescript-eslint/no-require-imports */
import path = require('path')
import fs   = require('fs')

interface ProcessInput {
  filePath?: string
  text?:     string
  nodeId?:   string
}

interface ProcessResult {
  filePath?: string
  text?:     string
}

interface ProcessContext {
  workspaceDir: string
  tempDir:      string
  nodeId:       string
  log:          (msg: string) => void
  progress:     (pct: number, label: string) => void
}

const DEFAULT_BASE_URL = 'http://127.0.0.1:7860'

function resolveBaseUrl(params: Record<string, unknown>): string {
  const url = (params['api_base_url'] as string | undefined)?.trim()
  return url || DEFAULT_BASE_URL
}

async function callSdApi(
  endpoint: string,
  payload:  Record<string, unknown>,
): Promise<{ images: string[] }> {
  let resp: Response
  try {
    resp = await fetch(endpoint, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })
  } catch (err) {
    throw new Error(`Network error reaching SD WebUI: ${String(err)}`)
  }
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`SD WebUI API error ${resp.status}: ${text.slice(0, 300)}`)
  }
  return resp.json() as Promise<{ images: string[] }>
}

function saveImage(base64: string, outDir: string, prefix: string): string {
  fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, `${prefix}-${Date.now()}.png`)
  const buf = Buffer.from(base64, 'base64')
  fs.writeFileSync(outPath, buf)
  return outPath
}

const processor = async (
  input:   ProcessInput,
  params:  Record<string, unknown>,
  context: ProcessContext,
): Promise<ProcessResult> => {
  const nodeId  = input.nodeId ?? context.nodeId ?? 'txt2img'
  const baseUrl = resolveBaseUrl(params)
  const outDir  = path.join(context.workspaceDir, 'Workflows')

  if (nodeId === 'img2img') {
    // ── img2img ──────────────────────────────────────────────────────────────
    if (!input.filePath) {
      throw new Error('stable-diffusion-webui/img2img: an input image file path is required')
    }

    context.progress(5, 'Reading input image…')
    const imgBuf = fs.readFileSync(input.filePath)
    const imgB64 = imgBuf.toString('base64')

    // If a text node is wired in, prepend its text to the prompt param
    const basePrompt     = (params['prompt'] as string) ?? ''
    const combinedPrompt = input.text ? `${input.text}${basePrompt ? ` ${basePrompt}` : ''}` : basePrompt

    const payload: Record<string, unknown> = {
      init_images:        [imgB64],
      prompt:             combinedPrompt,
      negative_prompt:    (params['negative_prompt']    as string)  ?? '',
      steps:              Number(params['steps']                    ?? 20),
      cfg_scale:          Number(params['cfg_scale']               ?? 7.0),
      width:              Number(params['width']                    ?? 512),
      height:             Number(params['height']                   ?? 512),
      sampler_name:       (params['sampler_name']       as string)  ?? 'Euler a',
      seed:               Number(params['seed']                     ?? -1),
      denoising_strength: Number(params['denoising_strength']       ?? 0.75),
    }

    context.progress(10, 'Sending img2img request to SD WebUI…')
    context.log(`POST ${baseUrl}/sdapi/v1/img2img`)

    let data: { images: string[] }
    try {
      data = await callSdApi(`${baseUrl}/sdapi/v1/img2img`, payload)
    } catch (err) {
      throw new Error(
        `Cannot reach SD WebUI at ${baseUrl} — make sure it is running with the --api flag. (${String(err)})`,
      )
    }

    if (!data.images?.[0]) throw new Error('SD WebUI returned no images for img2img')

    context.progress(90, 'Saving output image…')
    const outPath = saveImage(data.images[0], outDir, 'sd-img2img')
    context.progress(100, 'Done')
    context.log(`Output: ${outPath}`)
    return { filePath: outPath }

  } else {
    // ── txt2img (default) ────────────────────────────────────────────────────
    const basePrompt     = (params['prompt'] as string) ?? ''
    const combinedPrompt = input.text ? `${input.text}${basePrompt ? ` ${basePrompt}` : ''}` : basePrompt

    const payload: Record<string, unknown> = {
      prompt:          combinedPrompt,
      negative_prompt: (params['negative_prompt'] as string)  ?? '',
      steps:           Number(params['steps']                 ?? 20),
      cfg_scale:       Number(params['cfg_scale']             ?? 7.0),
      width:           Number(params['width']                 ?? 512),
      height:          Number(params['height']                ?? 512),
      sampler_name:    (params['sampler_name']    as string)  ?? 'Euler a',
      seed:            Number(params['seed']                  ?? -1),
    }

    context.progress(10, 'Sending txt2img request to SD WebUI…')
    context.log(`POST ${baseUrl}/sdapi/v1/txt2img`)

    let data: { images: string[] }
    try {
      data = await callSdApi(`${baseUrl}/sdapi/v1/txt2img`, payload)
    } catch (err) {
      throw new Error(
        `Cannot reach SD WebUI at ${baseUrl} — make sure it is running with the --api flag. (${String(err)})`,
      )
    }

    if (!data.images?.[0]) throw new Error('SD WebUI returned no images for txt2img')

    context.progress(90, 'Saving output image…')
    const outPath = saveImage(data.images[0], outDir, 'sd-txt2img')
    context.progress(100, 'Done')
    context.log(`Output: ${outPath}`)
    return { filePath: outPath }
  }
}

export = processor
