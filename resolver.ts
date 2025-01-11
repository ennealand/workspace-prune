import { resolve, toFileUrl } from '@std/path'
import type { DenoConfig, Workspaces } from './types.ts'

export const getWorkspaceResolver = (denoConfig: DenoConfig, { workspaceImports, workspaces }: Workspaces) => {
  const globalImporst = [...Object.entries(workspaces), ...Object.entries(denoConfig.imports)]

  const findMatch = (imports: [string, string][], specifier: string) => {
    let possibleMatch = undefined
    for (const item of imports) {
      if (specifier === item[0]) return item
      if (item[0].endsWith('/')) {
        if (specifier.startsWith(item[0])) return item
      } else if (specifier.startsWith(item[0] + '/')) possibleMatch = item
    }
    return possibleMatch
  }

  const remoteImports = new Map()

  const resolver = (specifier: string, referrer: string): string => {
    if (!referrer.startsWith('file://')) return specifier

    if (specifier.startsWith('../') || specifier.startsWith('./')) return new URL(specifier, referrer).href

    const workspace = denoConfig.workspace.find(workspace => referrer.startsWith(toFileUrl(resolve(workspace)).href + '/'))

    if (workspace && workspaceImports[workspace]) {
      const match = findMatch(workspaceImports[workspace], specifier)
      if (match) {
        let [key, value] = match
        const originalValue = value
        if (key !== specifier) {
          value += specifier.slice(key.length)
        }
        if (value in workspaces) return workspaces[value]
        if (value.startsWith('../') || value.startsWith('./')) {
          return toFileUrl(resolve(workspace, value)).href
        }
        if (!value.startsWith('file://')) {
          if (key !== specifier) remoteImports.set(key, originalValue)
          else remoteImports.set(specifier, value)
          return specifier
        }
        return value
      }
    }

    const match = findMatch(globalImporst, specifier)
    if (match) {
      let [key, value] = match
      if (key !== specifier) {
        console.log({ key, specifier })
        value += specifier.slice(key.length)
      }
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
