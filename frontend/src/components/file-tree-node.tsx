import React, { useEffect, useState } from 'react';
import { Handle, Position, NodeResizer, useReactFlow } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { Folder, File, X, RefreshCw } from 'lucide-react';
import { getWorkspaceTree } from '../api';

const TreeItem = ({ node, level = 0 }: { node: any; level?: number }) => {
  const [open, setOpen] = useState(level === 0);
  const isDir = node.type === 'directory';
  return (
    <div style={{ paddingLeft: level * 12, marginTop: 3, fontSize: 12 }}>
      <div
        onClick={() => isDir && setOpen(!open)}
        style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: isDir ? 'pointer' : 'default', color: '#e2e8f0' }}
      >
        {isDir
          ? <Folder size={12} color="#3b82f6" />
          : <File size={12} color="#94a3b8" />
        }
        <span>{node.name}</span>
      </div>
      {isDir && open && node.children && (
        <div style={{ borderLeft: '1px solid rgba(255,255,255,0.08)', marginLeft: 5 }}>
          {node.children.map((c: any, i: number) => <TreeItem key={i} node={c} level={level + 1} />)}
        </div>
      )}
    </div>
  );
};

export default function FileTreeNode({ id, data, selected }: NodeProps) {
  const { setNodes } = useReactFlow();
  const [tree, setTree] = useState<any>(null);

  const load = async () => {
    try { setTree(await getWorkspaceTree()); } catch {}
  };

  useEffect(() => { load(); }, []);

  return (
    <div
      className="glass-panel"
      style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <NodeResizer minWidth={200} minHeight={200} isVisible={!!selected} color="#f59e0b" />
      <Handle type="target" position={Position.Left} style={{ top: 0, left: 0, width: '100%', height: '100%', opacity: 0, zIndex: 0, background: 'transparent', border: 'none' }} />

      <div className="glass-header custom-drag-handle">
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Folder size={13} color="#f59e0b" /> Workspace
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={load} style={btn}><RefreshCw size={13} /></button>
          <button onClick={() => setNodes(nds => nds.filter(n => n.id !== id))} style={btn}><X size={13} /></button>
        </div>
      </div>

      <div
        className="nodrag"
        onWheel={e => { if (!e.ctrlKey) e.stopPropagation(); }}
        style={{ padding: 10, flex: 1, overflowY: 'auto' }}
      >
        {tree ? <TreeItem node={tree} /> : <div style={{ color: '#94a3b8', fontSize: 12 }}>Carregando...</div>}
      </div>

      <Handle type="source" position={Position.Right} style={{ background: '#f59e0b', width: 14, height: 14, zIndex: 6 }} />
    </div>
  );
}

const btn: React.CSSProperties = {
  background: 'none', border: 'none', color: '#e2e8f0', cursor: 'pointer',
  display: 'flex', alignItems: 'center', padding: 2,
};
