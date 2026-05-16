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

interface ProfileDefaults {
  width:        number
  height:       number
  steps:        number
  cfg_scale:    number
  sampler_name: string
  outPrefix:    string
  isSdxl:       boolean
}

function isSdxlNode(nodeId: string): boolean {
  return nodeId === 'sdxl_txt2img' || nodeId === 'sdxl_img2img'
}

function isImg2imgNode(nodeId: string): boolean {
  return nodeId === 'img2img' || nodeId === 'sdxl_img2img'
}

function profileFor(nodeId: string): ProfileDefaults {
  if (isSdxlNode(nodeId)) {
    return {
      width: 1024, height: 1024, steps: 28, cfg_scale: 6.0,
      sampler_name: 'DPM++ 2M Karras', outPrefix: 'sdxl', isSdxl: true,
    }
  }
  return {
    width: 512, height: 512, steps: 20, cfg_scale: 7.0,
    sampler_name: 'Euler a', outPrefix: 'sd', isSdxl: false,
  }
}

function resolveBaseUrl(params: Record<string, unknown>, profile: ProfileDefaults): string {
  const url = (params['api_base_url'] as string | undefined)?.trim()
  if (url) return url
  return profile.isSdxl ? 'http://127.0.0.1:7861' : 'http://127.0.0.1:7860'
}

function combinePrompt(input: ProcessInput, params: Record<string, unknown>): string {
  const basePrompt = (params['prompt'] as string) ?? ''
  return input.text ? `${input.text}${basePrompt ? ` ${basePrompt}` : ''}` : basePrompt
}

function applyOverrides(
  payload: Record<string, unknown>,
  params:  Record<string, unknown>,
  profile: ProfileDefaults,
): void {
  const ckpt = String(params['checkpoint'] ?? '').trim()
  if (ckpt) {
    payload['override_settings'] = { sd_model_checkpoint: ckpt }
  }
  if (profile.isSdxl) {
    const refiner = String(params['sdxl_refiner_checkpoint'] ?? '').trim()
    if (refiner) {
      payload['refiner_checkpoint'] = refiner
      payload['refiner_switch_at']  = Number(params['sdxl_refiner_switch_at'] ?? 0.8)
    }
  }
}

function buildSamplingPayload(
  params:  Record<string, unknown>,
  profile: ProfileDefaults,
  prompt:  string,
): Record<string, unknown> {
  return {
    prompt,
    negative_prompt: (params['negative_prompt'] as string) ?? '',
    steps:           Number(params['steps']          ?? profile.steps),
    cfg_scale:       Number(params['cfg_scale']      ?? profile.cfg_scale),
    width:           Number(params['width']          ?? profile.width),
    height:          Number(params['height']         ?? profile.height),
    sampler_name:    (params['sampler_name'] as string) ?? profile.sampler_name,
    seed:            Number(params['seed']           ?? -1),
  }
}

function connectionError(profile: ProfileDefaults, baseUrl: string, err: unknown): string {
  if (profile.isSdxl) {
    return (
      `Cannot reach SDXL WebUI at ${baseUrl}. Close SD 1.5 WebUI, run launch_with_sd_sdxl.bat, ` +
      `and set Settings → Integrations → SDXL URL. (${String(err)})`
    )
  }
  return (
    `Cannot reach SD 1.5 WebUI at ${baseUrl}. Run launch_with_sd.bat with --api. (${String(err)})`
  )
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

function saveImage(base64: string, outDir: string, prefix: string, mode: string): string {
  fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, `${prefix}-${mode}-${Date.now()}.png`)
  fs.writeFileSync(outPath, Buffer.from(base64, 'base64'))
  return outPath
}

const processor = async (
  input:   ProcessInput,
  params:  Record<string, unknown>,
  context: ProcessContext,
): Promise<ProcessResult> => {
  const nodeId  = input.nodeId ?? context.nodeId ?? 'txt2img'
  const profile = profileFor(nodeId)
  const baseUrl = resolveBaseUrl(params, profile)
  const outDir  = path.join(context.workspaceDir, 'Workflows')
  const prompt  = combinePrompt(input, params)

  if (isImg2imgNode(nodeId)) {
    if (!input.filePath) {
      throw new Error(`stable-diffusion-webui/${nodeId}: an input image file path is required`)
    }

    context.progress(5, 'Reading input image…')
    const imgB64 = fs.readFileSync(input.filePath).toString('base64')

    const payload = buildSamplingPayload(params, profile, prompt)
    payload['init_images']        = [imgB64]
    payload['denoising_strength'] = Number(params['denoising_strength'] ?? 0.75)
    applyOverrides(payload, params, profile)

    context.progress(10, `Sending ${profile.isSdxl ? 'SDXL' : 'SD'} img2img…`)
    context.log(`POST ${baseUrl}/sdapi/v1/img2img`)

    let data: { images: string[] }
    try {
      data = await callSdApi(`${baseUrl}/sdapi/v1/img2img`, payload)
    } catch (err) {
      throw new Error(connectionError(profile, baseUrl, err))
    }

    if (!data.images?.[0]) throw new Error('SD WebUI returned no images for img2img')

    context.progress(90, 'Saving output image…')
    const outPath = saveImage(data.images[0], outDir, profile.outPrefix, 'img2img')
    context.progress(100, 'Done')
    context.log(`Output: ${outPath}`)
    return { filePath: outPath }
  }

  const payload = buildSamplingPayload(params, profile, prompt)
  applyOverrides(payload, params, profile)

  context.progress(10, `Sending ${profile.isSdxl ? 'SDXL' : 'SD'} txt2img…`)
  context.log(`POST ${baseUrl}/sdapi/v1/txt2img`)

  let data: { images: string[] }
  try {
    data = await callSdApi(`${baseUrl}/sdapi/v1/txt2img`, payload)
  } catch (err) {
    throw new Error(connectionError(profile, baseUrl, err))
  }

  if (!data.images?.[0]) throw new Error('SD WebUI returned no images for txt2img')

  context.progress(90, 'Saving output image…')
  const outPath = saveImage(data.images[0], outDir, profile.outPrefix, 'txt2img')
  context.progress(100, 'Done')
  context.log(`Output: ${outPath}`)
  return { filePath: outPath }
}

export = processor
