import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as pty from 'node-pty';
import type { WebSocket } from 'ws';
import { assertWorkingDirectory } from './working-directory';
import { removeAgentFiles } from './agents';

export interface LiveTerminal {
  terminalId: string;
  userId: string;
  workspace: string;
  ptyProcess: pty.IPty;
  ws: WebSocket | null;
  token: string;
  isMaestro: boolean;
  roleName: string | null;
  workingDirectory: string;
  outputBuffer: string[];
  logStream: fs.WriteStream;
}

export const liveTerminals = new Map<string, LiveTerminal>();

export function findTerminalForUser(terminalId: string, userId: string, workspace?: string): LiveTerminal | undefined {
  const entry = liveTerminals.get(terminalId);
  return entry?.userId === userId && (!workspace || entry.workspace === workspace) ? entry : undefined;
}

const MAX_BUFFER_BYTES = 200_000;

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
  workingDirectory: string;
  aiCommand?: string;
  isMaestro: boolean;
  roleName: string | null;
  logPath: string;
  cliShimDir: string;
}

const port = Number(process.env.PORT) || 8080;

export function spawnTerminal(params: SpawnParams): LiveTerminal {
  const shellBin = params.shell === 'cmd' ? 'cmd.exe' : 'powershell.exe';
  const token = crypto.randomUUID();

  fs.mkdirSync(path.dirname(params.logPath), { recursive: true });
  assertWorkingDirectory(params.cwd);
  const logStream = fs.createWriteStream(params.logPath, { flags: 'a' });

  const ptyProcess = pty.spawn(shellBin, [], {
    name: 'xterm-color',
    cols: 80,
    rows: 30,
    cwd: params.cwd,
    env: {
      ...(process.env as Record<string, string>),
      KMESTRE_TERMINAL_ID: params.terminalId,
      KMESTRE_TOKEN: token,
      KMESTRE_API: `http://localhost:${port}`,
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
    workingDirectory: params.workingDirectory,
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
  try {
    removeAgentFiles(entry.workingDirectory, terminalId);
  } catch {}
  return true;
}

// Reinicia o PTY preservando o entry, o token e o WebSocket (usado pelo kmestre self).
// NÃO remove os agent files nem desconecta o frontend.
export function restartTerminal(
  terminalId: string,
  params: {
    shell: 'powershell' | 'cmd';
    cwd: string;
    aiCommand?: string;
    cliShimDir: string;
    roleName?: string | null;
  },
): boolean {
  const entry = liveTerminals.get(terminalId);
  if (!entry) return false;
  const shellBin = params.shell === 'cmd' ? 'cmd.exe' : 'powershell.exe';
  const ptyProcess = pty.spawn(shellBin, [], {
    name: 'xterm-color',
    cols: 80,
    rows: 30,
    cwd: params.cwd,
    env: {
      ...(process.env as Record<string, string>),
      KMESTRE_TERMINAL_ID: entry.terminalId,
      KMESTRE_TOKEN: entry.token,
      KMESTRE_API: `http://localhost:${port}`,
      PATH: `${params.cliShimDir}${path.delimiter}${process.env.PATH || ''}`,
    },
  });
  const previousPty = entry.ptyProcess;
  entry.ptyProcess = ptyProcess;
  if (params.roleName !== undefined) entry.roleName = params.roleName;
  ptyProcess.onData(data => {
    appendToBuffer(entry, data);
    entry.logStream.write(data);
    if (entry.ws && entry.ws.readyState === entry.ws.OPEN) entry.ws.send(data);
  });
  try { previousPty.kill(); } catch {}
  if (params.aiCommand) {
    setTimeout(() => ptyProcess.write(`${params.aiCommand}\r`), 300);
  }
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

export function broadcastLayoutChange(userId: string, workspace: string): void {
  const msg = '\x00LAYOUT:1';
  for (const entry of liveTerminals.values()) {
    if (entry.userId === userId && entry.workspace === workspace) {
      if (entry.ws && entry.ws.readyState === entry.ws.OPEN) entry.ws.send(msg);
    }
  }
}
