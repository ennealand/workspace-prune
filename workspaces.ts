import { resolve, toFileUrl } from 'jsr:@std/path'
import type { DenoConfig, Workspaces } from './types.ts'

export const getWorkspaces = async (denoConfig: DenoConfig): Promise<Workspaces> => {
  const workspaces: Record<string, string> = {}
  const workspaceImports: Record<string, [string, string][]> = {}
  const workspaceEntrypoints: Record<string, string> = {}

  await Promise.all(
    denoConfig.workspace.map(async (workspace: string) => {
      const config: DenoConfig = await Deno.readTextFile('./' + workspace + '/deno.json').then(JSON.parse)
      workspaceImports[workspace] = Object.entries(config.imports ?? {})
      if (!config.exports) return
      if (typeof config.exports === 'string') {
        workspaceEntrypoints[workspace] = toFileUrl(resolve(workspace, config.exports)).href
        if (config.name) workspaces[config.name] = workspaceEntrypoints[workspace]
      } else {
        for (const [key, value] of Object.entries(config.exports)) {
          workspaceEntrypoints[workspace] = toFileUrl(resolve(workspace, value)).href
          if (config.name) workspaces[config.name + key.slice(1)] = workspaceEntrypoints[workspace]
        }
      }
    })
  )

  return { workspaces, workspaceImports, workspaceEntrypoints }
}
