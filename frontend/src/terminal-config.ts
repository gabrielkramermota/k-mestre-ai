export interface RestartableTerminalConfig {
  aiCommand?: string;
  shell?: string;
  workingDirectory?: string;
  isMaestro?: boolean;
  roleName?: string;
  rolePrompt?: string;
}

export function terminalConfigRequiresRestart(
  before: RestartableTerminalConfig,
  after: RestartableTerminalConfig,
): boolean {
  return (
    (after.aiCommand || '') !== (before.aiCommand || '') ||
    (after.shell || 'powershell') !== (before.shell || 'powershell') ||
    (after.workingDirectory || '') !== (before.workingDirectory || '') ||
    Boolean(after.isMaestro) !== Boolean(before.isMaestro) ||
    (after.roleName || '') !== (before.roleName || '') ||
    (after.rolePrompt || '') !== (before.rolePrompt || '')
  );
}
