import { useState } from 'react';
import type { CSSProperties } from 'react';
import { toast } from 'sonner';
import { pickFolder } from '../api';

export interface NewWorkspaceChoice {
  name: string;
  defaultWorkingDirectory: string;
}

export default function NewWorkspaceModal({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: (choice: NewWorkspaceChoice) => void;
}) {
  const [name, setName] = useState('');
  const [dir, setDir] = useState('');
  const [picking, setPicking] = useState(false);

  const handlePickFolder = async () => {
    setPicking(true);
    try {
      const picked = await pickFolder();
      if (picked) setDir(picked);
    } finally {
      setPicking(false);
    }
  };

  const handleConfirm = () => {
    if (!name.trim()) {
      toast.error('Dê um nome para a nova área de trabalho.');
      return;
    }
    if (!dir.trim()) {
      toast.error('Escolha um diretório padrão para começar.');
      return;
    }
    onConfirm({ name: name.trim(), defaultWorkingDirectory: dir.trim() });
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle} className="glass-panel">
        <div style={headerRowStyle}>
          <button onClick={onCancel} style={linkBtnStyle}>Cancelar</button>
          <strong>Nova área de trabalho</strong>
          <button onClick={handleConfirm} style={{ ...linkBtnStyle, fontWeight: 600 }}>Criar</button>
        </div>

        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <label style={{ display: 'block' }}>
            <div className="mw-section-label">Nome</div>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); }}
              autoFocus
              className="mw-input"
            />
          </label>
          <label style={{ display: 'block' }}>
            <div className="mw-section-label">Diretório padrão</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={dir}
                onChange={e => setDir(e.target.value)}
                placeholder="Usado como padrão nos terminais criados aqui"
                className="mw-input"
                style={{ flex: 1 }}
              />
              <button onClick={handlePickFolder} disabled={picking} className="mw-secondary-btn">
                {picking ? '...' : 'Procurar...'}
              </button>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};
const modalStyle: CSSProperties = { width: 380, borderRadius: 18, overflow: 'hidden' };
const headerRowStyle: CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px',
  borderBottom: '1px solid var(--node-border)',
};
const linkBtnStyle: CSSProperties = { background: 'none', border: 'none', color: '#8b5cf6', cursor: 'pointer', fontSize: 14 };
