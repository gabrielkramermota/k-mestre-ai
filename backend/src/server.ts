import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { WebSocketServer, WebSocket } from 'ws';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { execFileSync } from 'child_process';
import { prisma, migrate } from './db';
import { liveTerminals, spawnTerminal, attachWs, detachWs, killTerminal } from './terminal-registry';
import { writeRoleFiles, roleDir } from './roles';
import { ensureCliShim } from './cli-shim';
import { orchestratorRouter } from './orchestrator-routes';
import {
  verifyPassword,
  hashPassword,
  createSession,
  destroySession,
  validateSessionToken,
  parseCookies,
  getSessionCookieName,
  requireAuth,
} from './auth';

const app = express();
const port = Number(process.env.PORT) || 8080;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

const appRoot = path.resolve(__dirname, '../');
const dataRoot = path.join(appRoot, 'data');

if (!fs.existsSync(dataRoot)) {
  fs.mkdirSync(dataRoot, { recursive: true });
}

function userDataRoot(userId: string): string {
  return path.join(dataRoot, userId);
}

function userVaultPath(userId: string): string {
  return path.join(userDataRoot(userId), 'vault');
}

function userWorkspacesPath(userId: string): string {
  return path.join(userDataRoot(userId), 'workspaces');
}

function userFilesPath(userId: string): string {
  return path.join(userDataRoot(userId), 'files');
}

function userLogsPath(userId: string): string {
  return path.join(userDataRoot(userId), 'logs');
}

function ensureUserDirs(userId: string): void {
  for (const dir of [userVaultPath(userId), userWorkspacesPath(userId), userFilesPath(userId), userLogsPath(userId)]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}

function layoutFilePath(userId: string, workspace?: string): string {
  const name = !workspace || workspace === 'default' ? 'default' : workspace.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(userWorkspacesPath(userId), `layout-${name}.json`);
}

function lastActiveWorkspaceFile(userId: string): string {
  return path.join(userWorkspacesPath(userId), 'last-active-workspace.txt');
}

function lastActiveWorkspace(userId: string): string {
  const f = lastActiveWorkspaceFile(userId);
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf-8').trim() || 'default' : 'default';
}

function getDirectoryTree(dirPath: string): any {
  const name = path.basename(dirPath);
  const item: any = { name, path: dirPath, type: 'directory', children: [] };
  try {
    for (const file of fs.readdirSync(dirPath)) {
      if (file.startsWith('.') || file === 'node_modules') continue;
      const fullPath = path.join(dirPath, file);
      if (fs.statSync(fullPath).isDirectory()) {
        item.children.push(getDirectoryTree(fullPath));
      } else {
        item.children.push({ name: file, path: fullPath, type: 'file' });
      }
    }
  } catch {}
  return item;
}

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) return res.status(400).json({ error: 'Informe usuário e senha.' });

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return res.status(401).json({ error: 'Usuário ou senha incorretos.' });

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Usuário ou senha incorretos.' });

  const userId = user.id;
  const { token, expiresAt } = await createSession(userId);
  ensureUserDirs(userId);

  res.cookie(getSessionCookieName(), token, {
    httpOnly: true,
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  });
  res.json({ success: true });
});

app.post('/api/auth/logout', async (req, res) => {
  const token = req.cookies?.[getSessionCookieName()];
  if (token) await destroySession(token);
  res.clearCookie(getSessionCookieName(), { path: '/' });
  res.json({ success: true });
});

app.get('/api/auth/me', async (req, res) => {
  const userId = await validateSessionToken(req.cookies?.[getSessionCookieName()]);
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });
  const user = await prisma.user.findUnique({ where: { id: userId } });
  res.json({ id: userId, username: user?.username });
});

app.use('/api/orchestrator', orchestratorRouter(dataRoot));
app.use('/api', requireAuth);

app.post('/api/auth/account', async (req, res) => {
  const { currentPassword, newUsername, newPassword } = req.body as {
    currentPassword?: string;
    newUsername?: string;
    newPassword?: string;
  };

  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

  if (!currentPassword || !(await verifyPassword(currentPassword, user.passwordHash))) {
    return res.status(401).json({ error: 'Senha atual incorreta' });
  }

  if (newUsername) {
    const exists = await prisma.user.findUnique({ where: { username: newUsername } });
    if (exists && exists.id !== user.id) {
      return res.status(409).json({ error: 'Este nome de usuário já existe' });
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(newUsername ? { username: newUsername } : {}),
      ...(newPassword ? { passwordHash: await hashPassword(newPassword) } : {}),
    },
  });

  res.json({ success: true, username: newUsername || user.username });
});

// ── Vault ─────────────────────────────────────────────────────────────────────

app.get('/api/vault/files', (req, res) => {
  try {
    const files = fs.readdirSync(userVaultPath(req.userId!)).filter(f => f.endsWith('.md'));
    res.json(files);
  } catch {
    res.status(500).json({ error: 'Failed to read vault' });
  }
});

app.get('/api/vault/files/:filename', (req, res) => {
  const { filename } = req.params;
  if (!filename.endsWith('.md')) return res.status(400).json({ error: 'Only .md files allowed' });
  const filePath = path.join(userVaultPath(req.userId!), filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.send(fs.readFileSync(filePath, 'utf-8'));
});

app.post('/api/vault/files/:filename', (req, res) => {
  const { filename } = req.params;
  if (!filename.endsWith('.md')) return res.status(400).json({ error: 'Only .md files allowed' });
  fs.writeFileSync(path.join(userVaultPath(req.userId!), filename), req.body.content || '', 'utf-8');
  res.json({ success: true });
});

// ── Workspace tree ────────────────────────────────────────────────────────────

app.get('/api/workspace/tree', (req, res) => {
  try {
    res.json(getDirectoryTree(userFilesPath(req.userId!)));
  } catch {
    res.status(500).json({ error: 'Failed to read tree' });
  }
});

app.get('/api/pick-folder', requireAuth, (_req, res) => {
  const script = [
    'Add-Type -AssemblyName System.Windows.Forms',
    '$dialog = New-Object System.Windows.Forms.FolderBrowserDialog',
    "$dialog.Description = 'Escolha o diretorio de trabalho'",
    'if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {',
    '  Write-Output $dialog.SelectedPath',
    '}',
  ].join('\n');

  try {
    const output = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      encoding: 'utf-8',
      timeout: 120_000,
    }).trim();
    res.json({ path: output || null });
  } catch (err: any) {
    res.status(500).json({ error: 'Falha ao abrir seletor de pasta: ' + err.message });
  }
});

app.delete('/api/terminals/:id', requireAuth, (req, res) => {
  const ok = killTerminal(String(req.params.id));
  res.json({ ok });
});

app.post('/api/terminals/:id/role', requireAuth, (req, res) => {
  const { workingDirectory, roleName, rolePrompt, roleColor, roleId } = req.body as {
    workingDirectory?: string;
    roleName?: string;
    rolePrompt?: string;
    roleColor?: string;
    roleId?: string;
  };

  if (!workingDirectory || !roleName || !rolePrompt) {
    return res.status(400).json({ error: 'workingDirectory, roleName e rolePrompt sao obrigatorios' });
  }

  const finalRoleId = roleId || crypto.randomUUID();

  try {
    writeRoleFiles({
      roleId: finalRoleId,
      roleName,
      rolePrompt,
      roleColor: roleColor || '#3b82f6',
      workingDirectory,
    });
    res.json({ roleId: finalRoleId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Layout (workspace-aware) ──────────────────────────────────────────────────

app.get('/api/layout', (req, res) => {
  const filePath = layoutFilePath(req.userId!, req.query.workspace as string);
  try {
    if (fs.existsSync(filePath)) {
      res.json(JSON.parse(fs.readFileSync(filePath, 'utf-8')));
    } else {
      res.json(null);
    }
  } catch {
    res.status(500).json({ error: 'Failed to read layout' });
  }
});

app.post('/api/layout', (req, res) => {
  const filePath = layoutFilePath(req.userId!, req.query.workspace as string);
  try {
    fs.writeFileSync(filePath, JSON.stringify(req.body, null, 2), 'utf-8');
    fs.writeFileSync(lastActiveWorkspaceFile(req.userId!), (req.query.workspace as string) || 'default', 'utf-8');
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to save layout' });
  }
});

// ── Workspaces list / delete ──────────────────────────────────────────────────

app.get('/api/workspaces', (req, res) => {
  try {
    const names: string[] = [];
    for (const f of fs.readdirSync(userWorkspacesPath(req.userId!))) {
      const m = f.match(/^layout-(.+)\.json$/);
      if (m) names.push(m[1]);
    }
    res.json(names);
  } catch {
    res.status(500).json({ error: 'Failed to list workspaces' });
  }
});

app.delete('/api/workspace/:name', (req, res) => {
  const { name } = req.params;
  const filePath = layoutFilePath(req.userId!, name);
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete workspace' });
  }
});

// ── Frontend estático (produção) ──────────────────────────────────────────────

const frontendDist = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.use((_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// ── HTTP + WebSocket server ───────────────────────────────────────────────────

async function respawnPersistedTerminals(cliShimDir: string): Promise<void> {
  const users = await prisma.user.findMany({ select: { id: true } });

  for (const { id: userId } of users) {
    ensureUserDirs(userId);
    const wsFile = lastActiveWorkspaceFile(userId);
    if (!fs.existsSync(wsFile)) continue;

    const workspace = fs.readFileSync(wsFile, 'utf-8').trim() || 'default';
    const layoutPath = layoutFilePath(userId, workspace);
    if (!fs.existsSync(layoutPath)) continue;

    let layout: { nodes: any[] };
    try {
      layout = JSON.parse(fs.readFileSync(layoutPath, 'utf-8'));
    } catch {
      continue;
    }

    for (const node of layout.nodes || []) {
      if (node.type !== 'terminal') continue;
      const data = node.data || {};
      if (!data.workingDirectory) continue; // no criado antes desta feature, sem os campos novos

      const cwd = data.roleName && data.roleId
        ? roleDir(data.workingDirectory, data.roleId)
        : data.workingDirectory;

      spawnTerminal({
        terminalId: node.id,
        userId,
        workspace,
        shell: data.shell === 'cmd' ? 'cmd' : 'powershell',
        cwd,
        aiCommand: data.aiCommand,
        isMaestro: !!data.isMaestro,
        roleName: data.roleName || null,
        logPath: path.join(userLogsPath(userId), `${node.id}-boot.log`),
        cliShimDir,
      });
    }
  }
}

const backendRoot = path.join(appRoot, 'backend');
const cliShimDir = ensureCliShim(backendRoot);

migrate()
  .then(async () => {
    await respawnPersistedTerminals(cliShimDir);

    const server = app.listen(port, () => {
      console.log(`Backend server listening at http://localhost:${port}`);
    });

    const wss = new WebSocketServer({ server, path: '/ws/terminal' });

    wss.on('connection', async (ws: WebSocket, req) => {
      const cookies = parseCookies(req.headers.cookie);
      const userId = await validateSessionToken(cookies[getSessionCookieName()]);
      if (!userId) {
        ws.close(4001, 'Unauthorized');
        return;
      }

      ensureUserDirs(userId);

      const url = new URL(req.url || '', 'http://localhost');
      const terminalId = url.searchParams.get('terminalId') || crypto.randomUUID();
      const workspace = url.searchParams.get('workspace') || lastActiveWorkspace(userId);

      let entry = liveTerminals.get(terminalId);

      if (entry) {
        attachWs(terminalId, ws);
      } else {
        const shell = (url.searchParams.get('shell') === 'cmd' ? 'cmd' : 'powershell') as 'cmd' | 'powershell';
        const cmd = url.searchParams.get('cmd') || undefined;
        const cwdParam = url.searchParams.get('cwd');
        const isMaestro = url.searchParams.get('maestro') === '1';
        const roleName = url.searchParams.get('roleName') || null;
        const roleIdParam = url.searchParams.get('roleId');
        const cwd = cwdParam
          ? (roleIdParam ? roleDir(cwdParam, roleIdParam) : cwdParam)
          : userFilesPath(userId);

        entry = spawnTerminal({
          terminalId,
          userId,
          workspace,
          shell,
          cwd,
          aiCommand: cmd,
          isMaestro,
          roleName,
          logPath: path.join(userLogsPath(userId), `${terminalId}.log`),
          cliShimDir,
        });
        attachWs(terminalId, ws);
      }

      ws.on('message', (msg) => {
        const text = msg.toString();
        if (text.startsWith('\x00RESIZE:')) {
          const [, colsStr, rowsStr] = text.split(':');
          const cols = parseInt(colsStr, 10);
          const rows = parseInt(rowsStr, 10);
          if (cols > 0 && rows > 0) {
            try { entry!.ptyProcess.resize(cols, rows); } catch {}
          }
          return;
        }
        entry!.ptyProcess.write(text);
      });
      ws.on('close', () => {
        detachWs(terminalId, ws);
      });
      ws.on('error', () => {
        detachWs(terminalId, ws);
      });
    });
  })
  .catch((err) => {
    console.error(
      '\nFalha ao aplicar as migrations do banco (prisma migrate deploy).\n' +
      'Verifique se DATABASE_URL (backend/.env) aponta pro arquivo SQLite certo e se ' +
      '"npx prisma migrate dev" já foi rodado ao menos uma vez neste projeto.\n'
    );
    console.error(err);
    process.exit(1);
  });
