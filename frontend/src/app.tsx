import { useState, useCallback, useRef, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  BackgroundVariant,
  Panel,
} from '@xyflow/react';
import type { NodeChange, EdgeChange, Node, Edge, Connection } from '@xyflow/react';
import { ConnectionMode } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Toaster, toast } from 'sonner';
import { TerminalSquare, StickyNote, FolderTree, Plus, Trash2, FolderOpen, LogOut, PanelLeftClose, PanelLeftOpen, Settings, Hand, MousePointer2 } from 'lucide-react';
import TerminalNode from './components/terminal-node';
import LoadingScreen from './components/loading-screen';
import NoteNode from './components/note-node';
import FileTreeNode from './components/file-tree-node';
import LoginPage from './components/login-page';
import TerminalLaunchModal from './components/terminal-launch-modal';
import type { TerminalLaunchChoice } from './components/terminal-launch-modal';
import NewWorkspaceModal from './components/new-workspace-modal';
import type { NewWorkspaceChoice } from './components/new-workspace-modal';
import ConfirmModal from './components/confirm-modal';
import SettingsModal from './components/settings-modal';
import { getLayout, saveLayout, getWorkspaces, deleteWorkspace, me, logout, deleteTerminal } from './api';

const nodeTypes = {
  terminal: TerminalNode,
  note: NoteNode,
  filetree: FileTreeNode,
};

const DEFAULT_SIZES: Record<string, { width: number; height: number }> = {
  terminal: { width: 600, height: 380 },
  note: { width: 360, height: 280 },
  filetree: { width: 280, height: 340 },
};

// ── Workspace Sidebar ─────────────────────────────────────────────────────────

interface SidebarProps {
  workspaces: string[];
  current: string;
  onSwitch: (name: string) => void;
  onNew: () => void;
  onDelete: (name: string) => void;
  username: string;
  onLogout: () => void;
  onCollapse: () => void;
  onSettings: () => void;
}

function WorkspaceSidebar({ workspaces, current, onSwitch, onNew, onDelete, username, onLogout, onCollapse, onSettings }: SidebarProps) {
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; ws: string } | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('contextmenu', close);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('contextmenu', close);
    };
  }, [ctxMenu]);

  const filtered = query.trim()
    ? workspaces.filter(ws => ws.toLowerCase().includes(query.trim().toLowerCase()))
    : workspaces;

  return (
    <div className="workspace-sidebar">
      <div className="workspace-brand">
        <div className="workspace-brand-text">
          <span className="workspace-brand-name">K-Mestre</span>
        </div>
        <button className="workspace-sidebar-collapse" onClick={onCollapse} title="Recolher">
          <PanelLeftClose size={14} />
        </button>
      </div>
      <div className="workspace-sidebar-header">
        <FolderOpen size={14} />
        <span>Áreas de trabalho</span>
      </div>
      <div className="workspace-sidebar-search">
        <input
          className="workspace-search-input"
          placeholder="Pesquisar..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>
      <div className="workspace-list">
        {filtered.map(ws => (
          <div
            key={ws}
            className={`workspace-item${current === ws ? ' active' : ''}`}
            onClick={() => onSwitch(ws)}
            onContextMenu={e => {
              e.preventDefault();
              e.stopPropagation();
              setCtxMenu({ x: e.clientX, y: e.clientY, ws });
            }}
          >
            <span className="workspace-name">{ws}</span>
          </div>
        ))}
      </div>
      {ctxMenu && (
        <div
          className="workspace-ctxmenu"
          style={{ top: ctxMenu.y, left: ctxMenu.x }}
          onClick={e => e.stopPropagation()}
        >
          <button
            className="workspace-ctxmenu-btn"
            onClick={() => { onDelete(ctxMenu.ws); setCtxMenu(null); }}
          >
            <Trash2 size={13} /> Excluir área de trabalho
          </button>
        </div>
      )}
      <button className="workspace-new-btn" onClick={onNew}>
        <Plus size={13} /> Nova Área de Trabalho
      </button>
      <div className="workspace-footer">
        <div className="workspace-footer-user">
          <span className="workspace-footer-username" title={username}>{username}</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="workspace-footer-logout" onClick={onSettings} title="Configurações">
            <Settings size={14} />
          </button>
          <button className="workspace-footer-logout" onClick={onLogout} title="Sair">
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Canvas (autenticado) ──────────────────────────────────────────────────────

interface CanvasProps {
  username: string;
  onLogout: () => void;
  onUsernameChange: (name: string) => void;
}

function Canvas({ username, onLogout, onUsernameChange }: CanvasProps) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [currentWorkspace, setCurrentWorkspace] = useState('');
  const [workspaces, setWorkspaces] = useState<string[]>([]);
  const currentWorkspaceRef = useRef(currentWorkspace);
  currentWorkspaceRef.current = currentWorkspace;
  const [defaultWorkingDirectory, setDefaultWorkingDirectory] = useState('');
  const defaultWorkingDirectoryRef = useRef(defaultWorkingDirectory);
  defaultWorkingDirectoryRef.current = defaultWorkingDirectory;
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tool, setTool] = useState<'move' | 'select'>('move');

  // Load layout for workspace
  const loadWorkspace = useCallback(async (ws: string) => {
    setLoaded(false);
    try {
      const layout = await getLayout(ws);
      if (layout?.nodes) {
        setNodes(layout.nodes);
        setEdges((layout.edges || []).map((e: Edge) => ({ ...e, style: undefined, animated: false })));
      } else {
        setNodes([]);
        setEdges([]);
      }
      setDefaultWorkingDirectory(layout?.defaultWorkingDirectory || '');
    } catch {
      setNodes([]);
      setEdges([]);
      setDefaultWorkingDirectory('');
    }
    setLoaded(true);
  }, []);

  // Piscar em azul a aresta entre dois terminais quando ha comunicacao real (kmestre send)
  useEffect(() => {
    const setEdgeActive = (a: string, b: string, active: boolean) => {
      setEdges(eds => eds.map(edge => {
        const matches = (edge.source === a && edge.target === b) || (edge.source === b && edge.target === a);
        if (!matches) return edge;
        return active
          ? { ...edge, animated: true, style: { stroke: '#8b5cf6', strokeWidth: 2 } }
          : { ...edge, animated: false, style: undefined };
      }));
    };
    const handler = (e: Event) => {
      const { a, b } = (e as CustomEvent).detail as { a: string; b: string };
      setEdgeActive(a, b, true);
      setTimeout(() => setEdgeActive(a, b, false), 1400);
    };
    window.addEventListener('terminal-activity', handler);
    return () => window.removeEventListener('terminal-activity', handler);
  }, []);

  // Um agente spawnou/alterou o layout (kmestre spawn) — recarrega sem flash
  useEffect(() => {
    const handler = () => {
      const ws = currentWorkspaceRef.current;
      if (!ws) return;
      getLayout(ws).then(layout => {
        if (layout?.nodes) {
          setNodes(layout.nodes);
          setEdges((layout.edges || []).map((e: Edge) => ({ ...e, style: undefined, animated: false })));
        }
      }).catch(() => {});
    };
    window.addEventListener('layout-changed', handler);
    return () => window.removeEventListener('layout-changed', handler);
  }, []);

  // Load workspaces list, open the first one if any exist
  useEffect(() => {
    getWorkspaces().then(async list => {
      setWorkspaces(list);
      if (list.length > 0) {
        setCurrentWorkspace(list[0]);
        currentWorkspaceRef.current = list[0];
        await loadWorkspace(list[0]);
      } else {
        setLoaded(true);
      }
    }).catch(() => setLoaded(true));
  }, [loadWorkspace]);

  // Persist layout
  const persistLayout = useCallback((newNodes: Node[], newEdges: Edge[]) => {
    if (!loaded || !currentWorkspaceRef.current) return;
    saveLayout(
      { nodes: newNodes, edges: newEdges, defaultWorkingDirectory: defaultWorkingDirectoryRef.current },
      currentWorkspaceRef.current,
    ).catch(() => {});
  }, [loaded]);

  // Edicao de terminal vinda do proprio no (renomear/editar) — persiste no layout
  useEffect(() => {
    const handler = (e: Event) => {
      const { id: nodeId, data: patch } = (e as CustomEvent).detail as { id: string; data: Record<string, unknown> };
      setNodes(nds => {
        const next = nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n);
        persistLayout(next, edges);
        return next;
      });
    };
    window.addEventListener('terminal-update', handler);
    return () => window.removeEventListener('terminal-update', handler);
  }, [edges, persistLayout]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes(nds => {
        const next = applyNodeChanges(changes, nds);
        const shouldSave = changes.some(c =>
          c.type === 'remove' ||
          (c.type === 'position' && !c.dragging) ||
          c.type === 'dimensions'
        );
        if (shouldSave) persistLayout(next, edges);

        // Mata PTYs de terminais removidos via teclado/box-select (Delete/Backspace)
        for (const c of changes) {
          if (c.type === 'remove' && nds.find(n => n.id === c.id)?.type === 'terminal') {
            deleteTerminal(c.id).catch(() => {});
          }
        }
        return next;
      });
    },
    [edges, persistLayout],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges(eds => {
        const next = applyEdgeChanges(changes, eds);
        persistLayout(nodes, next);
        return next;
      });
    },
    [nodes, persistLayout],
  );

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges(eds => {
        const next = addEdge(params, eds);
        persistLayout(nodes, next);
        return next;
      });
    },
    [nodes, persistLayout],
  );

  const addNode = (type: string, data: Record<string, unknown>, explicitId?: string) => {
    const size = DEFAULT_SIZES[type] ?? { width: 300, height: 250 };
    const node: Node = {
      id: explicitId || `${type}-${Date.now()}`,
      type,
      position: { x: Math.random() * 500 + 220, y: Math.random() * 400 + 80 },
      style: { width: size.width, height: size.height },
      data,
    };
    setNodes(nds => {
      const next = [...nds, node];
      persistLayout(next, edges);
      return next;
    });
  };

  // Workspace management
  const handleSwitchWorkspace = async (ws: string) => {
    if (currentWorkspace) {
      await saveLayout({ nodes, edges, defaultWorkingDirectory }, currentWorkspace);
    }
    setCurrentWorkspace(ws);
    currentWorkspaceRef.current = ws;
    await loadWorkspace(ws);
  };

  const [newWorkspaceModalOpen, setNewWorkspaceModalOpen] = useState(false);

  const handleCreateWorkspace = async (choice: NewWorkspaceChoice) => {
    setNewWorkspaceModalOpen(false);
    const safe = choice.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    await saveLayout({ nodes: [], edges: [], defaultWorkingDirectory: choice.defaultWorkingDirectory }, safe);
    const updated = await getWorkspaces();
    setWorkspaces(updated);
    await handleSwitchWorkspace(safe);
    toast.success(`Área de trabalho "${choice.name}" criada com sucesso.`);
  };

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const handleConfirmDeleteWorkspace = async () => {
    const name = deleteTarget;
    setDeleteTarget(null);
    if (!name) return;
    await deleteWorkspace(name);
    const updated = await getWorkspaces();
    setWorkspaces(updated);
    if (currentWorkspace === name) {
      if (updated.length > 0) {
        setCurrentWorkspace(updated[0]);
        currentWorkspaceRef.current = updated[0];
        await loadWorkspace(updated[0]);
      } else {
        setCurrentWorkspace('');
        currentWorkspaceRef.current = '';
        setNodes([]);
        setEdges([]);
        setDefaultWorkingDirectory('');
        setLoaded(true);
      }
    }
    toast.success(`Área de trabalho "${name}" excluída.`);
  };

  const [terminalModalOpen, setTerminalModalOpen] = useState(false);

  const handleTerminalConfirm = async (choice: TerminalLaunchChoice) => {
    setTerminalModalOpen(false);
    const terminalId = `terminal-${Date.now()}`;

    addNode('terminal', {
      label: choice.label,
      shell: choice.shell,
      aiCommand: choice.aiCommand,
      workingDirectory: choice.workingDirectory,
      monitorActivity: choice.monitorActivity,
      isMaestro: choice.isMaestro,
      roleName: choice.roleName || undefined,
      rolePrompt: choice.rolePrompt || undefined,
      roleColor: choice.roleColor || undefined,
    }, terminalId);
  };

  if (!loaded) {
    return <LoadingScreen />;
  }

  const handleLogout = async () => {
    await logout();
    onLogout();
  };

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex' }}>
      {sidebarOpen ? (
        <WorkspaceSidebar
          workspaces={workspaces}
          current={currentWorkspace}
          onSwitch={handleSwitchWorkspace}
          onNew={() => setNewWorkspaceModalOpen(true)}
          onDelete={setDeleteTarget}
          username={username}
          onLogout={handleLogout}
          onCollapse={() => setSidebarOpen(false)}
          onSettings={() => setSettingsOpen(true)}
        />
      ) : (
        <button className="workspace-sidebar-toggle" onClick={() => setSidebarOpen(true)} title="Abrir áreas de trabalho">
          <PanelLeftOpen size={18} />
        </button>
      )}

      <div style={{ flex: 1, position: 'relative' }}>
        {!currentWorkspace ? (
          <div style={{
            width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 12, color: '#64748b',
          }}>
            <FolderOpen size={32} />
            <span style={{ fontSize: 14 }}>Nenhuma área de trabalho ainda</span>
            <button className="workspace-new-btn" onClick={() => setNewWorkspaceModalOpen(true)}>
              <Plus size={13} /> Nova Área de Trabalho
            </button>
          </div>
        ) : (
        <>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          deleteKeyCode={['Delete', 'Backspace']}
          connectionMode={ConnectionMode.Loose}
          connectOnClick
          connectionRadius={250}
          isValidConnection={c => c.source !== c.target}
          defaultEdgeOptions={{
            style: { stroke: '#475569', strokeWidth: 1.5, strokeDasharray: '6 4' },
          }}
          panOnScroll
          panOnDrag={tool === 'move'}
          selectionOnDrag={tool === 'select'}
          selectionKeyCode={null}
          multiSelectionKeyCode={null}
          fitView
        >
          <Panel position="top-center" className="ui-panel glass-panel">
            <div className="ui-tool-group">
              <button
                className={`ui-btn${tool === 'move' ? ' active' : ''}`}
                onClick={() => setTool('move')}
                title="Mover (arraste para navegar o canvas)"
              >
                <Hand size={15} /> Mover
              </button>
              <button
                className={`ui-btn${tool === 'select' ? ' active' : ''}`}
                onClick={() => setTool('select')}
                title="Selecionar (arraste para marcar vários nós)"
              >
                <MousePointer2 size={15} /> Selecionar
              </button>
            </div>
            <span className="ui-panel-sep" />
            <button className="ui-btn" onClick={() => setTerminalModalOpen(true)}>
              <TerminalSquare size={15} /> Terminal
            </button>
            <button className="ui-btn" onClick={() => addNode('note', { filename: `Nota-${Date.now()}.md`, content: '' })}>
              <StickyNote size={15} /> Nota
            </button>
            <button className="ui-btn" onClick={() => addNode('filetree', {})}>
              <FolderTree size={15} /> Arquivos
            </button>
          </Panel>
          <Background variant={BackgroundVariant.Cross} gap={44} size={2} color="rgba(148, 163, 184, 0.55)" />
          <Controls style={{ backgroundColor: 'rgba(30, 33, 40, 0.8)', border: '1px solid rgba(255,255,255,0.1)' }} />
          <MiniMap
            style={{ backgroundColor: 'rgba(15, 17, 21, 0.9)', border: '1px solid rgba(255,255,255,0.1)' }}
            nodeColor={n => {
              switch (n.type) {
                case 'terminal': return '#8b5cf6';
                case 'note': return '#10b981';
                default: return '#f59e0b';
              }
            }}
            maskColor="rgba(0,0,0,0.4)"
          />
        </ReactFlow>

        {terminalModalOpen && (
          <TerminalLaunchModal
            onCancel={() => setTerminalModalOpen(false)}
            onConfirm={handleTerminalConfirm}
            defaultWorkingDirectory={defaultWorkingDirectory}
          />
        )}
        </>
        )}
      </div>

      {settingsOpen && (
        <SettingsModal
          username={username}
          onCancel={() => setSettingsOpen(false)}
          onSaved={newUsername => { setSettingsOpen(false); onUsernameChange(newUsername); }}
        />
      )}

      {newWorkspaceModalOpen && (
        <NewWorkspaceModal
          onCancel={() => setNewWorkspaceModalOpen(false)}
          onConfirm={handleCreateWorkspace}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Excluir área de trabalho"
          message={`Tem certeza que quer excluir "${deleteTarget}"? Os nodes e conexões dela serão perdidos.`}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDeleteWorkspace}
        />
      )}
    </div>
  );
}

// ── Auth gate ─────────────────────────────────────────────────────────────────

function AuthGate() {
  const [status, setStatus] = useState<'checking' | 'anon' | 'authed'>('checking');
  const [username, setUsername] = useState('');

  useEffect(() => {
    me().then(user => {
      if (user) {
        setUsername(user.username);
        setStatus('authed');
      } else {
        setStatus('anon');
      }
    });
  }, []);

  const handleLoginSuccess = async () => {
    const user = await me();
    if (user) {
      setUsername(user.username);
      setStatus('authed');
    }
  };

  if (status === 'checking') {
    return <LoadingScreen />;
  }

  return (
    <>
      <Toaster theme="dark" position="bottom-right" richColors />
      {status === 'anon'
        ? <LoginPage onSuccess={handleLoginSuccess} />
        : <Canvas username={username} onLogout={() => setStatus('anon')} onUsernameChange={setUsername} />}
    </>
  );
}

export default AuthGate;
