import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as pty from 'node-pty';
import type { WebSocket } from 'ws';

export interface LiveTerminal {
  terminalId: string;
  userId: string;
  workspace: string;
  ptyProcess: pty.IPty;
  ws: WebSocket | null;
  token: string;
  isMaestro: boolean;
  roleName: string | null;
  outputBuffer: string[];
  logStream: fs.WriteStream;
}

export const liveTerminals = new Map<string, LiveTerminal>();

const MAX_BUFFER_BYTES = 200_000;

const AGENT_BOOTSTRAP = `# Maestri — agente em canvas compartilhado

Você está rodando dentro do Maestri, um canvas que conecta agentes/terminais.

- Rode \`maestri list\` ANTES de falar sobre outros agentes ou terminais.
  A resposta vem do orquestrador (CLI maestri), NÃO da sua própria lista de
  subagentes/peers internos.
- Para mandar mensagem a um colega: \`maestri send <nome-ou-id> "<mensagem>"\`.
- Para ler a saída recente de um colega (resposta): \`maestri check <nome-ou-id>\`.
  Envie a mensagem, aguarde alguns segundos e use \`maestri check\` para ver a resposta.
- Notas conectadas: \`maestri list\` mostra as notas do canvas. Leia com
  \`maestri note read <nome.md>\`, edite com \`maestri note write <nome.md> "<conteudo>"\`
  e crie com \`maestri note create "<conteudo>" [--name "Nome"]\`.
`;

function writeAgentBootstrap(cwd: string): void {
  for (const file of ['CLAUDE.md', 'AGENTS.md']) {
    const p = path.join(cwd, file);
    if (!fs.existsSync(p)) fs.writeFileSync(p, AGENT_BOOTSTRAP, 'utf-8');
  }
}

export function appendToBuffer(entry: LiveTerminal, chunk: string): void {
  entry.outputBuffer.push(chunk);
  let total = entry.outputBuffer.reduce((n, c) => n + c.length, 0);
  while (total > MAX_BUFFER_BYTES && entry.outputBuffer.length > 1) {
    total -= entry.outputBuffer.shift()!.length;
  }
}

export interface SpawnParams {
  terminalId: string;
  userId: string;
  workspace: string;
  shell: 'powershell' | 'cmd';
  cwd: string;
  aiCommand?: string;
  isMaestro: boolean;
  roleName: string | null;
  logPath: string;
  cliShimDir: string;
}

export function spawnTerminal(params: SpawnParams): LiveTerminal {
  const shellBin = params.shell === 'cmd' ? 'cmd.exe' : 'powershell.exe';
  const token = crypto.randomUUID();

  fs.mkdirSync(path.dirname(params.logPath), { recursive: true });
  fs.mkdirSync(params.cwd, { recursive: true });
  if (params.aiCommand) writeAgentBootstrap(params.cwd);
  const logStream = fs.createWriteStream(params.logPath, { flags: 'a' });

  const ptyProcess = pty.spawn(shellBin, [], {
    name: 'xterm-color',
    cols: 80,
    rows: 30,
    cwd: params.cwd,
    env: {
      ...(process.env as Record<string, string>),
      MAESTRI_TERMINAL_ID: params.terminalId,
      MAESTRI_TOKEN: token,
      MAESTRI_API: 'http://localhost:3001',
      PATH: `${params.cliShimDir}${path.delimiter}${process.env.PATH}`,
    },
  });

  const entry: LiveTerminal = {
    terminalId: params.terminalId,
    userId: params.userId,
    workspace: params.workspace,
    ptyProcess,
    ws: null,
    token,
    isMaestro: params.isMaestro,
    roleName: params.roleName,
    outputBuffer: [],
    logStream,
  };

  ptyProcess.onData(data => {
    appendToBuffer(entry, data);
    logStream.write(data);
    if (entry.ws && entry.ws.readyState === entry.ws.OPEN) entry.ws.send(data);
  });

  liveTerminals.set(params.terminalId, entry);

  if (params.aiCommand) {
    setTimeout(() => ptyProcess.write(`${params.aiCommand}\r`), 300);
  }

  return entry;
}

export function attachWs(terminalId: string, ws: WebSocket): LiveTerminal | undefined {
  const entry = liveTerminals.get(terminalId);
  if (!entry) return undefined;
  entry.ws = ws;
  if (entry.outputBuffer.length) ws.send(entry.outputBuffer.join(''));
  return entry;
}

export function detachWs(terminalId: string, ws: WebSocket): void {
  const entry = liveTerminals.get(terminalId);
  if (entry && entry.ws === ws) entry.ws = null;
}

export function killTerminal(terminalId: string): boolean {
  const entry = liveTerminals.get(terminalId);
  if (!entry) return false;
  entry.ptyProcess.kill();
  entry.logStream.end();
  liveTerminals.delete(terminalId);
  return true;
}

export function sendToTerminal(terminalId: string, text: string): boolean {
  const entry = liveTerminals.get(terminalId);
  if (!entry) return false;
  entry.ptyProcess.write(`${text}\r`);
  return true;
}

export function notifyActivity(terminalId: string, peerId: string): void {
  const entry = liveTerminals.get(terminalId);
  if (entry?.ws && entry.ws.readyState === entry.ws.OPEN) {
    entry.ws.send(`\x00ACTIVITY:${peerId}`);
  }
}