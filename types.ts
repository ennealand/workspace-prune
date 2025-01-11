export type Workspaces = {
  workspaces: Record<string, string>
  workspaceImports: Record<string, [string, string][]>
  workspaceEntrypoints: Record<string, string>
}

export type DenoConfig = {
  name?: string
  workspace: string[]
  imports: Record<string, string>
  exports: Record<string, string> | string
}
