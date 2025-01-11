import { resolve, toFileUrl } from 'jsr:@std/path'
import type { DenoConfig, Workspaces } from './types.ts'

export const getWorkspaceResolver = (denoConfig: DenoConfig, { workspaceImports, workspaces }: Workspaces) => {
  const globalImporst = [...Object.entries(workspaces), ...Object.entries(denoConfig.imports)]

  function importMatch(this: string, [key]: [string, string]) {
    return this === key || (key.endsWith('/') ? this.startsWith(key) : this.startsWith(key + '/'))
  }

  const remoteImports = new Map()

  const resolver = (specifier: string, referrer: string): string => {
    if (!referrer.startsWith('file://')) return specifier

    if (specifier.startsWith('../') || specifier.startsWith('./')) return new URL(specifier, referrer).href

    const workspace = denoConfig.workspace.find(workspace => referrer.startsWith(toFileUrl(resolve(workspace)).href + '/'))

    if (workspace && workspaceImports[workspace]) {
      const match = workspaceImports[workspace].find(importMatch, specifier)
      if (match) {
        let [key, value] = match
        if (key !== specifier) value += specifier.slice(key.length)
        if (value in workspaces) return workspaces[value]
        if (value.startsWith('../') || value.startsWith('./')) {
          return toFileUrl(resolve(workspace, value)).href
        }
        if (!value.startsWith('file://')) {
          remoteImports.set(specifier, value)
          return specifier
        }
        return value
      }
    }

    const match = globalImporst.find(importMatch, specifier)
    if (match) {
      let [key, value] = match
      if (key !== specifier) value += specifier.slice(key.length)
      if (!value.startsWith('file://')) {
        remoteImports.set(specifier, value)
        return specifier
      }
      return value
    }

    return specifier
  }

  return { resolver, remoteImports }
}
