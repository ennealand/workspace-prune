import { createGraph } from 'jsr:@deno/graph'
import { relative } from 'jsr:@std/path'
import { getWorkspaceResolver } from './resolver.ts'
import type { DenoConfig, Workspaces } from './types.ts'

export const getGraph = async (workspace: string, denoConfig: DenoConfig, workspaces: Workspaces) => {
  const WORKDIR = Deno.cwd()

  const path = workspaces.workspaceEntrypoints[workspace]

  const { resolver, remoteImports } = getWorkspaceResolver(denoConfig, workspaces)
  const graph = await createGraph(path, { resolve: resolver, kind: 'codeOnly' })

  const files = new Set([relative('file://' + WORKDIR + '/_', path).slice(1)])
  const imports = new Map()

  for (const module of graph.modules.values()) {
    if (!module.dependencies) continue
    const map = []
    for (const dep of module.dependencies) {
      if (!dep.code?.specifier) continue

      if (dep.code.specifier.startsWith('file://')) {
        files.add(relative('file://' + WORKDIR + '/_', dep.code.specifier).slice(1))
        const relativePath = relative(module.specifier, dep.code.specifier)
        dep.code.specifier = relativePath.slice(relativePath.startsWith('../.') ? 3 : 1)
      }
      if (dep.specifier === dep.code.specifier) continue
      map.push({ specifier: dep.code.specifier, ...dep.code.span })
    }
    if (map.length) imports.set(relative('file://' + WORKDIR + '/_', module.specifier).slice(1), map)
  }

  return { files, imports, remoteImports }
}
