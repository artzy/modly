import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'

export interface AppSettings {
  modelsDir:        string
  workspaceDir:     string
  workflowsDir:     string
  extensionsDir:    string
  dependenciesDir:  string
  hfToken?:         string
  /** SD 1.5 WebUI API (launch_with_sd.bat, port 7860). */
  sdWebuiBaseUrl?:     string
  /** SDXL WebUI API (launch_with_sd_sdxl.bat, port 7861). */
  sdWebuiSdxlBaseUrl?: string
}

function settingsPath(userData: string): string {
  return join(userData, 'settings.json')
}

export function getSettings(userData: string): AppSettings {
  const defaults: AppSettings = {
    modelsDir:        join(userData, 'models'),
    workspaceDir:     join(userData, 'workspace'),
    workflowsDir:     join(userData, 'workflows'),
    extensionsDir:    join(userData, 'extensions'),
    dependenciesDir:  join(userData, 'dependencies'),
    sdWebuiBaseUrl:     'http://127.0.0.1:7860',
    sdWebuiSdxlBaseUrl: 'http://127.0.0.1:7861',
  }

  const file = settingsPath(userData)
  if (!existsSync(file)) return defaults

  try {
    const saved = JSON.parse(readFileSync(file, 'utf-8')) as Record<string, string>
    // Migrate legacy outputsDir key
    if (saved['outputsDir'] && !saved['workspaceDir']) {
      saved['workspaceDir'] = saved['outputsDir']
      delete saved['outputsDir']
    }
    return { ...defaults, ...saved }
  } catch {
    return defaults
  }
}

export function setSettings(userData: string, patch: Partial<AppSettings>): AppSettings {
  const updated = { ...getSettings(userData), ...patch }
  writeFileSync(settingsPath(userData), JSON.stringify(updated, null, 2), 'utf-8')
  return updated
}
