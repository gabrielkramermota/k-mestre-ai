import { Router, Request, Response, NextFunction } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { liveTerminals, sendToTerminal, notifyActivity, spawnTerminal, killTerminal, broadcastLayoutChange } from './terminal-registry';
import { writeAgentFiles, buildLaunchCommand, agentDir, notesDir } from './agents';

interface CanvasNode {
  id: string;
  type: string;
  position?: { x: number; y: number };
  data?: Record<string, unknown>;
}
interface CanvasEdge {
  source: string;
  target: string;
  id?: string;
}
interface CanvasLayout {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

function layoutPathFor(dataRoot: string, userId: string, workspace: string): string {
  const name = !workspace || workspace === 'default' ? 'default' : workspace.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(dataRoot, userId, 'workspaces', `layout-${name}.json`);
}

function readLayout(dataRoot: string, userId: string, workspace: string): CanvasLayout {
  const filePath = layoutPathFor(dataRoot, userId, workspace);
  if (!fs.existsSync(filePath)) return { nodes: [], edges: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return { nodes: parsed.nodes || [], edges: parsed.edges || [] };
  } catch {
    return { nodes: [], edges: [] };
  }
}

function connectedIdsOf(edges: CanvasEdge[], terminalId: string): Set<string> {
  const ids = new Set<string>();
  for (const e of edges) {
    if (e.source === terminalId) ids.add(e.target);
    if (e.target === terminalId) ids.add(e.source);
  }
  return ids;
}

function requireTerminalToken(req: Request, res: Response, next: NextFunction): void {
  const token = req.header('X-Kmestre-Token');
  const entry = token ? [...liveTerminals.values()].find(t => t.token === token) : undefined;
  if (!entry) {
    res.status(401).json({ error: 'Token de terminal invalido ou ausente.' });
    return;
  }
  (req as any).terminalEntry = entry;
  next();
}

export function orchestratorRouter(dataRoot: string, cliShimDir: string): Router {
  const router = Router();
  router.use(requireTerminalToken);

  router.get('/list', (req: Request, res: Response) => {
    const entry = (req as any).terminalEntry;
    const layout = readLayout(dataRoot, entry.userId, entry.workspace);
    const connectedIds = connectedIdsOf(layout.edges, entry.terminalId);

    const teammates = layout.nodes
      .filter(n => n.type === 'terminal' && n.id !== entry.terminalId)
      .filter(n => entry.isMaestro || connectedIds.has(n.id))
      .map(n => ({
        id: n.id,
        name: (n.data?.label as string) || n.id,
        roleName: (n.data?.roleName as string) || null,
      }));

    const notes = layout.nodes
      .filter(n => n.type === 'note' && (entry.isMaestro || connectedIds.has(n.id)))
      .map(n => ({ filename: (n.data?.filename as string) || '' }));

    res.json({ teammates, notes });
  });

  router.post('/send', (req: Request, res: Response) => {
    const entry = (req as any).terminalEntry;
    const { target, message } = req.body as { target?: string; message?: string };
    if (!target || !message) {
      res.status(400).json({ error: 'target e message sao obrigatorios' });
      return;
    }

    const layout = readLayout(dataRoot, entry.userId, entry.workspace);
    const connectedIds = connectedIdsOf(layout.edges, entry.terminalId);

    const targetNode = layout.nodes.find(
      n => n.type === 'terminal' && (n.id === target || n.data?.roleName === target || n.data?.label === target),
    );
    if (!targetNode) {
      res.status(404).json({ error: `Terminal '${target}' nao encontrado no canvas.` });
      return;
    }
    if (!entry.isMaestro && !connectedIds.has(targetNode.id)) {
      res.status(403).json({ error: `Terminal '${target}' nao esta conectado a este terminal.` });
      return;
    }

    const ok = sendToTerminal(targetNode.id, message);
    if (!ok) {
      res.status(409).json({ error: `Terminal '${target}' nao esta aberto agora.` });
      return;
    }

    notifyActivity(entry.terminalId, targetNode.id);
    notifyActivity(targetNode.id, entry.terminalId);

    res.json({ ok: true });
  });

  router.post('/spawn', (req: Request, res: Response) => {
    const entry = (req as any).terminalEntry;
    if (!entry.isMaestro) {
      res.status(403).json({ error: 'Somente o Maestro pode criar novos terminais.' });
      return;
    }

    const { name, role, cmd, dir, color } = req.body as { name?: string; role?: string; cmd?: string; dir?: string; color?: string };
    if (!name) {
      res.status(400).json({ error: 'name e obrigatorio' });
      return;
    }

    const layoutPath = layoutPathFor(dataRoot, entry.userId, entry.workspace);
    let layout: any = { nodes: [], edges: [] };
    if (fs.existsSync(layoutPath)) {
      try { layout = JSON.parse(fs.readFileSync(layoutPath, 'utf-8')); } catch { layout = { nodes: [], edges: [] }; }
    }
    if (!Array.isArray(layout.nodes)) layout.nodes = [];
    if (!Array.isArray(layout.edges)) layout.edges = [];

    const sourceNode = layout.nodes.find((n: any) => n.id === entry.terminalId);
    const defaultDir = (sourceNode?.data?.workingDirectory as string) || '';
    const hasCmd = typeof cmd === 'string';
    const defaultCmd = (sourceNode?.data?.aiCommand as string) || undefined;
    const workingDirectory = dir?.trim() || defaultDir;
    if (!workingDirectory) {
      res.status(400).json({ error: 'Maestro sem diretorio de trabalho definido; informe --dir.' });
      return;
    }
    const aiCommand = hasCmd ? (cmd.trim() || undefined) : defaultCmd;

    // Posiciona o novo terminal em grade, afastado do maestro (direita), sem sobrepor.
    const sourcePos = sourceNode?.position || { x: 0, y: 0 };
    const siblings = layout.edges.filter((e: any) => e.source === entry.terminalId).length;
    const gap = 720; // largura do terminal (600) + margem
    const col = siblings % 3;
    const row = Math.floor(siblings / 3);
    const position = {
      x: sourcePos.x + 400 + col * gap,
      y: sourcePos.y + row * 480,
    };

    const terminalId = `terminal-${Date.now()}`;
    const rolePrompt = role?.trim() || null;
    const shell = 'powershell';
    const roleColor = color?.trim() || null;

    writeAgentFiles({
      terminalId,
      label: name,
      shell,
      aiCommand,
      workspace: entry.workspace,
      workingDirectory,
      isMaestro: false,
      roleName: rolePrompt ? name : null,
      rolePrompt,
      roleColor,
    });

    const instructionsPath = path.join(agentDir(workingDirectory, terminalId), 'CLAUDE.md');
    const finalCommand = buildLaunchCommand(aiCommand, instructionsPath, shell);

    spawnTerminal({
      terminalId,
      userId: entry.userId,
      workspace: entry.workspace,
      shell,
      cwd: workingDirectory,
      workingDirectory,
      aiCommand: finalCommand,
      isMaestro: false,
      roleName: rolePrompt ? name : null,
      logPath: path.join(dataRoot, entry.userId, 'logs', `${terminalId}.log`),
      cliShimDir,
    });

    layout.nodes.push({
      id: terminalId,
      type: 'terminal',
      position,
      style: { width: 600, height: 380 },
      data: {
        label: name,
        shell,
        aiCommand,
        workingDirectory,
        monitorActivity: true,
        isMaestro: false,
        roleName: rolePrompt ? name : undefined,
        rolePrompt: rolePrompt || undefined,
        roleColor: roleColor || undefined,
      },
    });
    layout.edges.push({ source: entry.terminalId, target: terminalId, id: `xy-edge__${entry.terminalId}-${terminalId}` });
    fs.writeFileSync(layoutPath, JSON.stringify(layout, null, 2), 'utf-8');

    broadcastLayoutChange(entry.userId, entry.workspace);
    res.json({ ok: true, terminalId, name });
  });

  router.post('/self', (req: Request, res: Response) => {
    const entry = (req as any).terminalEntry;
    const { role, prompt, color, label } = req.body as {
      role?: string;
      prompt?: string;
      color?: string;
      label?: string;
    };
    if (!prompt?.trim()) {
      res.status(400).json({ error: 'prompt e obrigatorio' });
      return;
    }

    const layoutPath = layoutPathFor(dataRoot, entry.userId, entry.workspace);
    let layout: any = { nodes: [], edges: [] };
    if (fs.existsSync(layoutPath)) {
      try { layout = JSON.parse(fs.readFileSync(layoutPath, 'utf-8')); } catch { layout = { nodes: [], edges: [] }; }
    }
    if (!Array.isArray(layout.nodes)) layout.nodes = [];
    if (!Array.isArray(layout.edges)) layout.edges = [];

    const node = layout.nodes.find((n: any) => n.id === entry.terminalId);
    const data = node?.data || {};
    const workingDirectory = (data.workingDirectory as string) || entry.workingDirectory;
    const shell = data.shell === 'cmd' ? 'cmd' : 'powershell';
    const roleName = role?.trim() || (data.roleName as string) || null;
    const roleColor = color?.trim() || (data.roleColor as string) || null;

    writeAgentFiles({
      terminalId: entry.terminalId,
      label: label?.trim() || (data.label as string) || entry.terminalId,
      shell,
      aiCommand: data.aiCommand as string | undefined,
      workspace: entry.workspace,
      workingDirectory,
      isMaestro: entry.isMaestro,
      roleName,
      rolePrompt: prompt.trim(),
      roleColor,
    });

    // Atualiza o layout (label, papel, cor) para o canvas refletir.
    if (node) {
      if (label?.trim()) node.data = { ...data, label: label.trim() };
      node.data = {
        ...node.data,
        roleName: roleName || undefined,
        rolePrompt: prompt.trim(),
        roleColor: roleColor || undefined,
      };
      fs.writeFileSync(layoutPath, JSON.stringify(layout, null, 2), 'utf-8');
    }

    // Reinicia o PTY com o novo prompt injetado.
    killTerminal(entry.terminalId);
    const instructionsPath = path.join(agentDir(workingDirectory, entry.terminalId), 'CLAUDE.md');
    const aiCommand = buildLaunchCommand(data.aiCommand as string | undefined, instructionsPath, shell);
    try {
      spawnTerminal({
        terminalId: entry.terminalId,
        userId: entry.userId,
        workspace: entry.workspace,
        shell,
        cwd: workingDirectory,
        workingDirectory,
        aiCommand,
        isMaestro: entry.isMaestro,
        roleName,
        logPath: path.join(dataRoot, entry.userId, 'logs', `${entry.terminalId}.log`),
        cliShimDir,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
      return;
    }

    broadcastLayoutChange(entry.userId, entry.workspace);
    res.json({ ok: true });
  });

  router.get('/output', (req: Request, res: Response) => {
    const entry = (req as any).terminalEntry;
    const target = String(req.query.target || '');

    if (!target) {
      res.status(400).json({ error: 'target e obrigatorio' });
      return;
    }

    const layout = readLayout(dataRoot, entry.userId, entry.workspace);
    const connectedIds = connectedIdsOf(layout.edges, entry.terminalId);

    const targetNode = layout.nodes.find(
      n => n.type === 'terminal' && (n.id === target || n.data?.roleName === target || n.data?.label === target),
    );
    if (!targetNode) {
      res.status(404).json({ error: `Terminal '${target}' nao encontrado no canvas.` });
      return;
    }
    if (!entry.isMaestro && !connectedIds.has(targetNode.id)) {
      res.status(403).json({ error: `Terminal '${target}' nao esta conectado a este terminal.` });
      return;
    }

    const targetEntry = liveTerminals.get(targetNode.id);
    if (!targetEntry) {
      res.status(409).json({ error: `Terminal '${target}' nao esta aberto agora.` });
      return;
    }

    res.json({ output: targetEntry.outputBuffer.join('').slice(-8000) });
  });

  

  function layoutWithMeta(dataRoot: string, userId: string, workspace: string): CanvasLayout & { defaultWorkingDirectory?: string } {
    const filePath = layoutPathFor(dataRoot, userId, workspace);
    if (!fs.existsSync(filePath)) return { nodes: [], edges: [] };
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      return {
        nodes: parsed.nodes || [],
        edges: parsed.edges || [],
        defaultWorkingDirectory: parsed.defaultWorkingDirectory,
      };
    } catch {
      return { nodes: [], edges: [] };
    }
  }

  function notePath(entry: any, filename: string): string {
    const layout = layoutWithMeta(dataRoot, entry.userId, entry.workspace);
    const wd = layout.defaultWorkingDirectory || entry.workingDirectory;
    return path.join(notesDir(wd), filename);
  }

  function isNoteConnected(entry: any, layout: CanvasLayout, filename: string): boolean {
    const connectedIds = connectedIdsOf(layout.edges, entry.terminalId);
    return layout.nodes.some(
      n => n.type === 'note' && n.data?.filename === filename && (entry.isMaestro || connectedIds.has(n.id)),
    );
  }

  router.get('/note', (req: Request, res: Response) => {
    const entry = (req as any).terminalEntry;
    const name = String(req.query.name || '');
    if (!name.endsWith('.md')) {
      res.status(400).json({ error: 'name e obrigatorio (arquivo .md)' });
      return;
    }
    if (!isNoteConnected(entry, readLayout(dataRoot, entry.userId, entry.workspace), name)) {
      res.status(404).json({ error: `Nota '${name}' nao esta conectada a este terminal.` });
      return;
    }
    const filePath = notePath(entry, name);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: `Arquivo da nota '${name}' nao encontrado.` });
      return;
    }
    res.json({ content: fs.readFileSync(filePath, 'utf-8') });
  });

  router.post('/note', (req: Request, res: Response) => {
    const entry = (req as any).terminalEntry;
    const { name, content } = req.body as { name?: string; content?: string };
    if (!name || !name.endsWith('.md')) {
      res.status(400).json({ error: 'name e obrigatorio (arquivo .md)' });
      return;
    }
    if (!isNoteConnected(entry, readLayout(dataRoot, entry.userId, entry.workspace), name)) {
      res.status(404).json({ error: `Nota '${name}' nao esta conectada a este terminal.` });
      return;
    }
    fs.mkdirSync(path.dirname(notePath(entry, name)), { recursive: true });
    fs.writeFileSync(notePath(entry, name), content || '', 'utf-8');
    res.json({ ok: true });
  });

  router.post('/note/create', (req: Request, res: Response) => {
    const entry = (req as any).terminalEntry;
    const { name, content } = req.body as { name?: string; content?: string };
    const base = (name && /^[^\\/]+$/.test(name) ? name.replace(/[^a-zA-Z0-9_-]/g, '_') : null) || `Nota-${Date.now()}`;
    const filename = `${base}.md`;

    fs.mkdirSync(path.dirname(notePath(entry, filename)), { recursive: true });
    fs.writeFileSync(notePath(entry, filename), content || '', 'utf-8');

    const layoutPath = layoutPathFor(dataRoot, entry.userId, entry.workspace);
    let layout: any = { nodes: [], edges: [] };
    if (fs.existsSync(layoutPath)) {
      try { layout = JSON.parse(fs.readFileSync(layoutPath, 'utf-8')); } catch { layout = { nodes: [], edges: [] }; }
    }
    if (!Array.isArray(layout.nodes)) layout.nodes = [];
    if (!Array.isArray(layout.edges)) layout.edges = [];

    const noteId = `note-${Date.now()}`;
    layout.nodes.push({ id: noteId, type: 'note', position: { x: 0, y: 0 }, data: { filename, content: content || '' } });
    layout.edges.push({ source: entry.terminalId, target: noteId, id: `xy-edge__${entry.terminalId}-${noteId}` });
    fs.writeFileSync(layoutPath, JSON.stringify(layout, null, 2), 'utf-8');

    res.json({ ok: true, filename });
  });

  return router;
}