import type { WorkflowExtension } from './mockExtensions'

export const SD_EXTENSION_ID = 'stable-diffusion-webui'

export const VRAM_SEQUENTIAL_HINT =
  'Tip (12GB VRAM): Close Stable Diffusion WebUI or enable "Unload checkpoint after" before the 3D step.'

export function sdExtensionRoot(extensionId: string | undefined): boolean {
  if (!extensionId) return false
  return extensionId.split('/')[0] === SD_EXTENSION_ID
}

export function workflowOutputType(
  ext: WorkflowExtension | undefined,
  nodeInputPath: string | undefined,
): 'image' | 'text' | 'mesh' | undefined {
  if (ext?.output) return ext.output
  return nodeInputPath ? 'mesh' : undefined
}

export function vramHintIfNextIsModel(
  extId: string,
  execNodes: { data: { extensionId?: string } }[],
  index: number,
  allExtensions: WorkflowExtension[],
  getExt: (id: string) => WorkflowExtension | undefined,
): string | null {
  if (!sdExtensionRoot(extId)) return null
  const next = execNodes[index + 1]
  if (!next) return null
  const nextExt = getExt(next.data.extensionId ?? '')
  if (nextExt?.type !== 'model') return null
  return VRAM_SEQUENTIAL_HINT
}
