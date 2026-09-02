import { useState, useEffect, useCallback, useRef } from 'react';
import { Handle, Position, NodeResizer, useReactFlow } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Clipboard, RefreshCw, Copy, Bold, Italic, Code, Heading1, List, Quote, Link2, Trash2, Check } from 'lucide-react';
import { readFile, saveFile } from '../api';

type SaveState = 'saved' | 'saving' | 'error';

export default function NoteNode({ id, data, selected }: NodeProps) {
  const { setNodes, getNode } = useReactFlow();
  const filename = (data.filename as string) || 'NovaNota.md';
  const [content, setContent] = useState((data.content as string) || '');
  const [mode, setMode] = useState<'write' | 'preview'>('preview');
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const lastSavedRef = useRef(content);

  // Derived display name from first non-empty line
  const displayName = (() => {
    const first = content.split('\n').find(l => l.trim());
    if (!first) return filename;
    return first.replace(/^#+\s*/, '').trim().slice(0, 40) || filename;
  })();

  // Initial load from disk
  useEffect(() => {
    readFile(filename).then(c => {
      setContent(c);
      lastSavedRef.current = c;
    }).catch(() => {});
  }, [filename]);

  // Autosave (debounced) — skips changes that match the last saved/loaded value
  useEffect(() => {
    if (lastSavedRef.current === content) return;
    setSaveState('saving');
    const t = setTimeout(() => {
      saveFile(filename, content)
        .then(() => {
          lastSavedRef.current = content;
          setSaveState('saved');
        })
        .catch(() => setSaveState('error'));
    }, 800);
    return () => clearTimeout(t);
  }, [content, filename]);

  // Focus the textarea when entering write mode
  useEffect(() => {
    if (mode === 'write') taRef.current?.focus();
  }, [mode]);

  // Click outside the note → back to preview
  useEffect(() => {
    if (mode !== 'write') return;
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setMode('preview');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [mode]);

  useEffect(() => {
    if (editingTitle) {
      setTitleDraft(displayName.replace(/\.md$/i, ''));
      titleInputRef.current?.focus();
    }
  }, [editingTitle]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleReload = useCallback(() => {
    readFile(filename).then(c => {
      setContent(c);
      lastSavedRef.current = c;
      setSaveState('saved');
    }).catch(() => {});
  }, [filename]);

  const handleDuplicate = useCallback(() => {
    const node = getNode(id);
    const newFilename = `Nota-${Date.now()}.md`;
    saveFile(newFilename, content).catch(() => {});
    const pos = node?.position || { x: 0, y: 0 };
    setNodes(nds => [
      ...nds,
      {
        id: `note-${Date.now()}`,
        type: 'note',
        position: { x: pos.x + 48, y: pos.y + 48 },
        data: { filename: newFilename, content },
      },
    ]);
  }, [id, content, getNode, setNodes]);

  const handleDelete = () => {
    setNodes(nds => nds.filter(n => n.id !== id));
  };

  const handleCopyContent = useCallback(() => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  }, [content]);

  const commitTitle = () => {
    setEditingTitle(false);
    const trimmed = titleDraft.trim().replace(/\.md$/i, '');
    if (!trimmed) return;
    const lines = content.split('\n');
    const idx = lines.findIndex(l => l.trim());
    const heading = idx >= 0 && /^#+\s*/.test(lines[idx]) ? '# ' : '';
    const next = [...lines];
    if (idx >= 0) next[idx] = `${heading}${trimmed}`;
    else next.unshift(`${heading}${trimmed}`);
    setContent(next.join('\n'));
  };

  const applyFormat = (before: string, after = '', linePrefix = '') => {
    const ta = taRef.current;
    if (!ta) {
      setContent(c => linePrefix + before + c + after);
      return;
    }
    const { selectionStart, selectionEnd } = ta;
    const lineStart = content.lastIndexOf('\n', selectionStart - 1) + 1;
    let next: string;
    if (linePrefix) {
      const selText = content.slice(lineStart, selectionEnd);
      next = content.slice(0, lineStart) + linePrefix + selText + content.slice(selectionEnd);
      setContent(next);
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(lineStart + linePrefix.length, selectionEnd + linePrefix.length);
      });
      return;
    }
    const sel = content.slice(selectionStart, selectionEnd);
    next = content.slice(0, selectionStart) + before + sel + after + content.slice(selectionEnd);
    setContent(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(selectionStart + before.length, selectionEnd + before.length);
    });
  };

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  return (
    <div
      ref={rootRef}
      className="glass-panel"
      style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <NodeResizer minWidth={220} minHeight={150} isVisible={!!selected} color="#10b981" />
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
        style={{ background: '#10b981', width: 14, height: 14, zIndex: 6, border: '2px solid rgba(15, 17, 21, 0.9)', cursor: 'crosshair' }}
      />
      <Handle
        type="source"
        id="connect"
        position={Position.Right}
        title="Conectar para a direita"
        style={{ background: '#10b981', width: 14, height: 14, zIndex: 6, border: '2px solid rgba(15, 17, 21, 0.9)', cursor: 'crosshair' }}
      />
      <Handle
        type="source"
        id="src-bottom"
        position={Position.Bottom}
        title="Conectar para baixo"
        style={{ background: '#10b981', width: 14, height: 14, zIndex: 6, border: '2px solid rgba(15, 17, 21, 0.9)', cursor: 'crosshair' }}
      />
      <Handle
        type="source"
        id="src-left"
        position={Position.Left}
        title="Conectar para a esquerda"
        style={{ background: '#10b981', width: 14, height: 14, zIndex: 6, border: '2px solid rgba(15, 17, 21, 0.9)', cursor: 'crosshair' }}
      />

      {selected && (
        <div className="node-toolbar nodrag">
          {mode === 'write' && (
            <>
              <button title="Negrito" onClick={() => applyFormat('**', '**')}><Bold size={13} /></button>
              <button title="Itálico" onClick={() => applyFormat('*', '*')}><Italic size={13} /></button>
              <button title="Código" onClick={() => applyFormat('`', '`')}><Code size={13} /></button>
              <button title="Título" onClick={() => applyFormat('', '', '# ')}><Heading1 size={13} /></button>
              <button title="Lista" onClick={() => applyFormat('', '', '- ')}><List size={13} /></button>
              <button title="Citação" onClick={() => applyFormat('', '', '> ')}><Quote size={13} /></button>
              <div className="node-toolbar-divider" />
            </>
          )}
          <div className="node-toolbar-connect" title="Arraste para conectar">
            <Link2 size={13} />
            <Handle
              type="source"
              position={Position.Top}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: 'none', borderRadius: 6, background: 'transparent', border: 'none' }}
            />
          </div>
          <button title="Recarregar do disco" onClick={handleReload}><RefreshCw size={13} /></button>
          <button title="Duplicar nota" onClick={handleDuplicate}><Copy size={13} /></button>
          <button title="Copiar conteúdo" onClick={handleCopyContent}>
            {copied ? <Check size={13} color="#10b981" /> : <Clipboard size={13} />}
          </button>
          <button title="Excluir" className="danger" onClick={handleDelete}><Trash2 size={13} /></button>
        </div>
      )}

      <div
        className="glass-header custom-drag-handle"
        onClick={editingTitle ? undefined : () => setEditingTitle(true)}
        title="Clique para renomear"
        style={{ cursor: 'text' }}
      >
        {editingTitle ? (
          <input
            ref={titleInputRef}
            value={titleDraft}
            onChange={e => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={e => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
            style={{
              background: 'transparent', border: 'none', borderBottom: '1px solid #10b981',
              color: '#e2e8f0', fontFamily: 'Inter, sans-serif', fontSize: 12.5,
              fontWeight: 600, outline: 'none', width: '100%', minWidth: 40,
            }}
          />
        ) : (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
              {displayName}
            </span>
          </span>
        )}
      </div>

      <div
        className="nodrag"
        onWheel={e => { if (!e.ctrlKey) e.stopPropagation(); }}
        style={{ flex: 1, overflowY: 'auto', cursor: mode === 'preview' ? 'text' : 'default' }}
      >
        {mode === 'write' ? (
          <textarea
            ref={taRef}
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Escreva aqui... (markdown)"
            style={{
              width: '100%', height: '100%', minHeight: 100,
              background: 'transparent', border: 'none', outline: 'none',
              color: '#e2e8f0', fontFamily: 'Inter, sans-serif', fontSize: 13,
              lineHeight: 1.6, padding: 12, boxSizing: 'border-box', resize: 'none',
            }}
          />
        ) : (
          <div
            onClick={() => setMode('write')}
            style={{ fontSize: 13, lineHeight: 1.6, color: '#cbd5e1', padding: 12 }}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content || '*Clique para escrever...*'}
            </ReactMarkdown>
          </div>
        )}
      </div>

      <div
        className="nodrag"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 10px', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: 10.5, color: '#64748b', flexShrink: 0 }}
      >
        <span>{saveState === 'saving' ? 'Salvando…' : saveState === 'error' ? 'Erro ao salvar' : 'Salvo'}</span>
        <span>{wordCount} {wordCount === 1 ? 'palavra' : 'palavras'}</span>
      </div>
    </div>
  );
}