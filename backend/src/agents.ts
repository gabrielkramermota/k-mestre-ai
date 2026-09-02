import * as fs from 'fs';
import * as path from 'path';

export const AGENT_BOOTSTRAP = `# K-Mestre — agente em canvas compartilhado

Você está rodando dentro do K-Mestre, um canvas que conecta agentes/terminais.

- Rode \`kmestre list\` ANTES de falar sobre outros agentes ou terminais.
  A resposta vem do orquestrador (CLI kmestre), NÃO da sua própria lista de
  subagentes/peers internos.
- Para mandar mensagem a um colega: \`kmestre send <nome-ou-id> "<mensagem>"\`.
- Para ler a saída recente de um colega (resposta): \`kmestre check <nome-ou-id>\`.
  Envie a mensagem, aguarde alguns segundos e use \`kmestre check\` para ver a resposta.
- Para criar um especialista (novo terminal) quando o usuário pedir um time:
  \`kmestre spawn "Nome" --role "<prompt do papel>" [--cmd claude|codex|opencode] [--dir "caminho"] [--color "#hex"]\`.
  Só o Maestro pode criar; o novo agente nasce conectado a você. Escolha uma cor da paleta
  (ex.: #8b5cf6 roxo, #3b82f6 azul, #10b981 verde, #f59e0b laranja, #ef4444 vermelho, #ec4899 rosa).
- Um terminal comum (sem papel), apenas com um objetivo da conversa:
  \`kmestre spawn "Nome"\` (herda seu comando) ou \`kmestre spawn "Nome" --cmd ""\` (shell puro).
- Notas conectadas: \`kmestre list\` mostra as notas do canvas. Leia com
  \`kmestre note read <nome.md>\`, edite com \`kmestre note write <nome.md> "<conteudo>"\`
  e crie com \`kmestre note create "<conteudo>" [--name "Nome"]\`.
`;

export function agentDir(workingDirectory: string, terminalId: string): string {
  return path.join(workingDirectory, '.kmestre', 'agents', terminalId);
}

function kmestreRoot(workingDirectory: string): string {
  return path.join(workingDirectory, '.kmestre');
}

function ensureGitignore(workingDirectory: string): void {
  const root = kmestreRoot(workingDirectory);
  fs.mkdirSync(root, { recursive: true });
  const gi = path.join(root, '.gitignore');
  if (!fs.existsSync(gi)) fs.writeFileSync(gi, '*\n!.gitignore\n', 'utf-8');
}

function buildInstructions(rolePrompt: string | null, workingDirectory: string): string {
  const parts = [AGENT_BOOTSTRAP];
  if (rolePrompt?.trim()) {
    parts.push('', '<your_assigned_role>', rolePrompt, '</your_assigned_role>', '');
  }
  parts.push(
    '',
    '<working_directory>',
    'IMPORTANT: You were started in this directory to work on the project at:',
    workingDirectory,
    '</working_directory>',
    '',
  );
  return parts.join('\n');
}

export interface AgentFilesParams {
  terminalId: string;
  label: string;
  shell: string;
  aiCommand?: string;
  workspace: string;
  workingDirectory: string;
  isMaestro: boolean;
  roleName: string | null;
  rolePrompt: string | null;
  roleColor: string | null;
}

export function writeAgentFiles(params: AgentFilesParams): void {
  ensureGitignore(params.workingDirectory);
  const dir = agentDir(params.workingDirectory, params.terminalId);
  fs.mkdirSync(dir, { recursive: true });

  const instructions = buildInstructions(params.rolePrompt, params.workingDirectory);
  fs.writeFileSync(path.join(dir, 'CLAUDE.md'), instructions, 'utf-8');
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), instructions, 'utf-8');

  fs.writeFileSync(
    path.join(dir, 'terminal.json'),
    JSON.stringify(
      {
        schemaVersion: 2,
        terminalId: params.terminalId,
        label: params.label,
        shell: params.shell,
        aiCommand: params.aiCommand || null,
        workspace: params.workspace,
        workingDirectory: params.workingDirectory,
        isMaestro: params.isMaestro,
        roleName: params.roleName,
        rolePrompt: params.rolePrompt,
        roleColor: params.roleColor,
        updatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    'utf-8',
  );
}

export function removeAgentFiles(workingDirectory: string, terminalId: string): void {
  fs.rmSync(agentDir(workingDirectory, terminalId), { recursive: true, force: true });
}

// Builds the launch command that injects the instructions file into the agent.
// File-based where the CLI supports it (Claude); inline for Codex. Shell puro / desconhecido: sem injeção.
export function buildLaunchCommand(
  aiCommand: string | undefined,
  instructionsPath: string,
  shell: 'powershell' | 'cmd',
): string | undefined {
  if (!aiCommand?.trim()) return aiCommand;
  const base = aiCommand.trim();
  const lower = base.toLowerCase();

  if (lower.startsWith('claude')) {
    const q = shell === 'cmd' ? '"' : '"';
    return `${base} --append-system-prompt-file ${q}${instructionsPath}${q}`;
  }

  if (lower.startsWith('codex')) {
    const content = fs.existsSync(instructionsPath) ? fs.readFileSync(instructionsPath, 'utf-8') : '';
    const toml = content
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\r?\n/g, '\\n');
    if (shell === 'powershell') {
      const kv = `developer_instructions="${toml}"`;
      return `${base} --config '${kv.replace(/'/g, "''")}'`;
    }
    return `${base} --config "developer_instructions=${toml.replace(/"/g, '""')}"`;
  }

  return base;
}