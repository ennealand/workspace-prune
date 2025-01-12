/**
 * This script isolates workspace members for efficient docker setup similar to `turbo prune`
 */

import { ensureDir, exists } from '@std/fs'
import { dirname, resolve } from '@std/path'
import { applyReplacements } from './fs.ts'
import { getGraph } from './prune.ts'
import { getWorkspaces } from './workspaces.ts'

const config = await Deno.readTextFile('./deno.json').then(JSON.parse)

if (!config.workspace) {
  console.log('%cNo workspace found in deno.json', 'color:red')
  Deno.exit(1)
}

if (!Deno.args.length) {
  console.log('%cNo workspace members provided', 'color:red')
  console.log(`%cAvailable options: %c${config.workspace.join(' ')}`, 'color:blue', 'color:yellow')
  Deno.exit(1)
}

const prepareWorkspace = async (workspace: string) => {
  if (!config.workspace.includes(workspace)) {
    console.log(`%cWorkspace member %c${workspace}%c is not valid`, 'color:red', 'color:yellow', 'color:red')
    console.log(`%cAvailable options: %c${config.workspace.join(' ')}`, 'color:blue', 'color:yellow')
    Deno.exit(1)
  }

  const workspaces = await getWorkspaces(config)
  const { files, imports, remoteImports } = await getGraph(workspace, config, workspaces)
  const toOutput = (...file: string[]) => resolve('./.out', workspace.replace('/', '_'), ...file)

  if (await exists(toOutput())) {
    await Deno.remove(toOutput(), { recursive: true })
  }

  const filesToCopy = files.values().filter(file => !imports.has(file))
  const copiedFiles = Promise.all(
    filesToCopy.map(async file => {
      const output = toOutput('full', file)
      await ensureDir(dirname(output))
      await Deno.copyFile(file, output)
    })
  )

  const editedFiles = Promise.all(imports.entries().map(([file, deps]) => applyReplacements(file, toOutput('full', file), deps)))

  const newConfig = { ...config, imports: Object.fromEntries(remoteImports) }
  delete newConfig.workspace
  const copiedConfig = (async () => {
    const output = toOutput('deno.json')
    await ensureDir(dirname(output))
    await Deno.writeTextFile(output, JSON.stringify(newConfig, null, 2))
  })()

  await Promise.all([copiedFiles, editedFiles, copiedConfig])
}

await Promise.all(Deno.args.map(prepareWorkspace))
console.log(`%c🎉 Successfully pruned: %c${Deno.args.join(' ')}`, 'color:green', 'color:yellow')
