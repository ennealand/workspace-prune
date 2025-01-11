import { dirname } from 'jsr:@std/path'
import { ensureDir } from 'jsr:@std/fs'

type pos = { line: number; character: number; cursor?: number }
type dep = { specifier: string; start: pos; end: pos }

export const applyReplacements = async (input: string, output: string, dependencies: dep[]) => {
  await ensureDir(dirname(output))
  const [inputFile, outputFile] = await Promise.all([
    Deno.open(input, { read: true }),
    Deno.open(output, { write: true, create: true }),
  ])

  let line = 0
  let character = 0
  let dep
  let depEnd = 0
  const NEW_LINE = '\n'.charCodeAt(0)
  const encoder = new TextEncoder()

  for await (const chunk of inputFile.readable) {
    if (depEnd === dependencies.length) await outputFile.write(chunk)
    else {
      let cursor = 0
      let shift = 0
      const depStart = depEnd
      dep = dependencies[depEnd]
      for (const char of chunk) {
        if (dep.start.line === line) {
          if (dep.start.character === character) {
            dep.start.cursor = cursor + 1
          }
          if (dep.end.character === character) {
            dep.end.cursor = cursor - 1
            shift += dep.specifier.length - (dep.end.cursor - dep.start.cursor!)
            depEnd++
            if (depEnd === dependencies.length) break
            dep = dependencies[depEnd]
          }
          character++
        }
        if (char === NEW_LINE) {
          line++
          character = 0
        }
        cursor++
      }
      const newChunk = new Uint8Array(chunk.length + shift)
      let next = 0
      let last = 0
      for (let i = depStart; i < depEnd; i++) {
        const start = dependencies[i].start.cursor!
        newChunk.set(chunk.subarray(last, start), next)
        newChunk.set(encoder.encode(dependencies[i].specifier), next + start - last)
        next += start - last + dependencies[i].specifier.length
        last = dependencies[i].end.cursor!
      }
      if (last) newChunk.set(chunk.subarray(last), next)
      await outputFile.write(newChunk)
    }
  }
}
