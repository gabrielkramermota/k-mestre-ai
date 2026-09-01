import React, { useEffect, useRef, useState } from 'react';
import { Handle, Position, NodeResizer, useReactFlow } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { TerminalSquare, Crown, Link2, Pencil, RotateCw, Trash2 } from 'lucide-react';
import { deleteTerminal } from '../api';
import EditTerminalModal from './edit-terminal-modal';
import type { EditTerminalValues } from './edit-terminal-modal';

export default function TerminalNode({ id, data, selected }: NodeProps) {
  const { setNodes } = useReactFlow();
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const cleanupRef = useRef<() => void>(() => {});
  const [label, setLabel] = useState((data.label as string) || 'Terminal');
  const [editingLabel, setEditingLabel] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const labelInputRef = useRef<HTMLInputElement>(null);

  const mountTerminal = () => {
    if (!terminalRef.current) return;
    terminalRef.current.innerHTML = '';

    const term = new Terminal({
      theme: { background: 'rgba(10, 12, 16, 0.95)', foreground: '#e2e8f0', cursor: '#8b5cf6' },
      fontFamily: 'Consolas, monospace',
      fontSize: 13,
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const params = new URLSearchParams({ terminalId: id, shell: (data.shell as string) || 'powershell' });
    if (data.aiCommand) params.set('cmd', data.aiCommand as string);
    if (data.workingDirectory) params.set('cwd', data.workingDirectory as string);
    if (data.roleId) params.set('roleId', data.roleId as string);
    if (data.roleName) params.set('roleName', data.roleName as string);
    if (data.isMaestro) params.set('maestro', '1');

    const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws/terminal?${params.toString()}`);
    wsRef.current = ws;

    const sendResize = () => {
      if (ws.readyState === WebSocket.OPEN) ws.send(`\x00RESIZE:${term.cols}:${term.rows}`);
    };

    ws.onopen = () => {
      term.writeln('\x1b[32m[K-Mestre AI — conectado]\x1b[0m');
      sendResize();
    };
    ws.onmessage = e => {
      const msg = e.data as string;
      if (typeof msg === 'string' && msg.startsWith('\x00ACTIVITY:')) {
        const peerId = msg.slice('\x00ACTIVITY:'.length);
        window.dispatchEvent(new CustomEvent('terminal-activity', { detail: { a: id, b: peerId } }));
        return;
      }
      term.write(msg);
    };
    ws.onerror = () => term.writeln('\x1b[31m[Erro de conexão]\x1b[0m');
    ws.onclose = () => term.writeln('\x1b[31m[Desconectado]\x1b[0m');
    term.onData(d => { if (ws.readyState === WebSocket.OPEN) ws.send(d); });
    term.onResize(sendResize);

    const ro = new ResizeObserver(() => { try { fitAddon.fit(); } catch {} });
    ro.observe(terminalRef.current);

    cleanupRef.current = () => {
      ro.disconnect();
      ws.close();
      term.dispose();
    };
  };

  useEffect(() => {
    mountTerminal();
    return () => cleanupRef.current();
  }, []);

  const commitLabel = () => {
    setEditingLabel(false);
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, label } } : n));
  };

  useEffect(() => {
    if (editingLabel) labelInputRef.current?.focus();
  }, [editingLabel]);

  const handleDelete = () => {
    deleteTerminal(id).catch(() => {});
    setNodes(nds => nds.filter(n => n.id !== id));
  };

  const handleReload = async () => {
    cleanupRef.current();
    await deleteTerminal(id).catch(() => {});
    mountTerminal();
  };

  const handleSaveEdit = (values: EditTerminalValues) => {
    setEditModalOpen(false);
    setLabel(values.label);
    setNodes(nds => nds.map(n => n.id === id
      ? { ...n, data: { ...n.data, label: values.label, monitorActivity: values.monitorActivity, isMaestro: values.isMaestro } }
      : n));
  };

  return (
    <div
      className="glass-panel"
      style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <NodeResizer
        minWidth={320}
        minHeight={200}
        isVisible={!!selected}
        color="#8b5cf6"
        handleStyle={{ zIndex: 10 }}
        lineStyle={{ zIndex: 10 }}
      />
      <Handle
        type="target"
        position={Position.Left}
        isConnectableStart={false}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', transform: 'none', opacity: 0, zIndex: 0, background: 'transparent', border: 'none', cursor: 'default' }}
      />
      <Handle
        type="source"
        id="src-top"
        position={Position.Top}
        title="Conectar para cima"
        style={{ background: '#8b5cf6', width: 14, height: 14, zIndex: 6, border: '2px solid rgba(15, 17, 21, 0.9)', cursor: 'crosshair' }}
      />
      <Handle
        type="source"
        id="connect"
        position={Position.Right}
        title="Conectar para a direita"
        style={{ background: '#8b5cf6', width: 14, height: 14, zIndex: 6, border: '2px solid rgba(15, 17, 21, 0.9)', cursor: 'crosshair' }}
      />
      <Handle
        type="source"
        id="src-bottom"
        position={Position.Bottom}
        title="Conectar para baixo"
        style={{ background: '#8b5cf6', width: 14, height: 14, zIndex: 6, border: '2px solid rgba(15, 17, 21, 0.9)', cursor: 'crosshair' }}
      />
      <Handle
        type="source"
        id="src-left"
        position={Position.Left}
        title="Conectar para a esquerda"
        style={{ background: '#8b5cf6', width: 14, height: 14, zIndex: 6, border: '2px solid rgba(15, 17, 21, 0.9)', cursor: 'crosshair' }}
      />

      {selected && (
        <div className="node-toolbar nodrag">
          <button title="Editar" onClick={() => setEditModalOpen(true)}>
            <Pencil size={13} />
          </button>
          <div className="node-toolbar-connect" title="Arraste para conectar">
            <Link2 size={13} />
            <Handle
              type="source"
              id="toolbar"
              position={Position.Top}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: 'none', borderRadius: 6, background: 'transparent', border: 'none' }}
            />
          </div>
          <button title="Recarregar" onClick={handleReload}>
            <RotateCw size={13} />
          </button>
          <button title="Excluir" onClick={handleDelete} className="danger">
            <Trash2 size={13} />
          </button>
        </div>
      )}

      <div className="glass-header custom-drag-handle" style={data.isMaestro ? { borderBottom: '1px solid #facc15' } : undefined}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, overflow: 'hidden' }}>
          <TerminalSquare size={14} color="#8b5cf6" />
          {Boolean(data.isMaestro) && <Crown size={13} color="#facc15" />}
          {editingLabel ? (
            <input
              ref={labelInputRef}
              value={label}
              onChange={e => setLabel(e.target.value)}
              onBlur={commitLabel}
              onKeyDown={e => { if (e.key === 'Enter') commitLabel(); if (e.key === 'Escape') setEditingLabel(false); }}
              style={{
                background: 'transparent', border: 'none', borderBottom: '1px solid #8b5cf6',
                color: '#e2e8f0', fontFamily: 'Inter, sans-serif', fontSize: 14,
                fontWeight: 600, outline: 'none', width: '100%',
              }}
            />
          ) : (
            <span
              onDoubleClick={() => setEditingLabel(true)}
              title="Duplo-clique para renomear"
              style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'text' }}
            >
              {label}
            </span>
          )}
        </span>
      </div>

      <div
        className="nodrag"
        onWheel={e => { if (!e.ctrlKey) e.stopPropagation(); }}
        style={{ flex: 1, padding: 6, overflow: 'hidden', minHeight: 0 }}
      >
        <div ref={terminalRef} style={{ width: '100%', height: '100%' }} />
      </div>

      {editModalOpen && (
        <EditTerminalModal
          initial={{
            label,
            monitorActivity: data.monitorActivity !== false,
            isMaestro: Boolean(data.isMaestro),
          }}
          onCancel={() => setEditModalOpen(false)}
          onSave={handleSaveEdit}
        />
      )}
    </div>
  );
}
