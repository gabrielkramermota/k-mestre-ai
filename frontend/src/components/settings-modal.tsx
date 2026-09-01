import { useState } from 'react';
import type { CSSProperties } from 'react';
import { toast } from 'sonner';
import { Sparkles } from 'lucide-react';
import { changeAccount } from '../api';
import { APP_VERSION } from '../version';

export default function SettingsModal({
  username,
  onCancel,
  onSaved,
}: {
  username: string;
  onCancel: () => void;
  onSaved: (username: string) => void;
}) {
  const [tab, setTab] = useState<'conta' | 'sobre'>('conta');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newUsername, setNewUsername] = useState(username);
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!currentPassword.trim()) {
      toast.error('Informe a senha atual.');
      return;
    }
    setSaving(true);
    try {
      const res = await changeAccount(currentPassword.trim(), newUsername.trim(), newPassword);
      toast.success('Conta atualizada.');
      onSaved(res.username);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle} className="glass-panel">
        <div style={headerRowStyle}>
          <button onClick={onCancel} style={linkBtnStyle}>Cancelar</button>
          <strong>Configurações</strong>
          {tab === 'conta' ? (
            <button onClick={handleSave} disabled={saving} style={{ ...linkBtnStyle, fontWeight: 600 }}>
              {saving ? '...' : 'Salvar'}
            </button>
          ) : (
            <span style={{ width: 44 }} />
          )}
        </div>

        <div className="mw-tabs" style={{ paddingTop: 8 }}>
          <button className={`mw-tab${tab === 'conta' ? ' active' : ''}`} onClick={() => setTab('conta')}>Conta</button>
          <button className={`mw-tab${tab === 'sobre' ? ' active' : ''}`} onClick={() => setTab('sobre')}>Sobre</button>
        </div>

        {tab === 'conta' ? (
          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="Nome de usuário">
              <input value={newUsername} onChange={e => setNewUsername(e.target.value)} className="mw-input" />
            </Field>
            <Field label="Nova senha (opcional)">
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Deixe vazio para manter a atual"
                className="mw-input"
              />
            </Field>
            <Field label="Senha atual (obrigatória)">
              <input
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="Confirme sua senha atual"
                className="mw-input"
              />
            </Field>
          </div>
        ) : (
          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', textAlign: 'center' }}>
            <img src="/logo.png" alt="K-Mestre AI" style={{ width: 140, height: 'auto' }} />
            <div style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9' }}>K-Mestre AI</div>
            <div className="mw-section-label" style={{ margin: 0 }}>
              Versão <span style={{ color: '#93c5fd' }}>v{APP_VERSION}</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 260 }}>
              Um orquestrador de IA visual: conecte agentes, terminais e notas em um canvas
              compartilhado. Você é o líder, o Maestro coordena a equipe.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
              <span>
                Autor:{' '}
                <a href="https://www.linkedin.com/in/gabriel-kramer-desenvolvedor/" target="_blank" rel="noreferrer" style={{ color: '#93c5fd' }}>
                  Gabriel Kramer Mota
                </a>
              </span>
              <span>Licença: MIT</span>
            </div>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', textDecoration: 'none', marginTop: 4 }}
            >
              <Sparkles size={16} /> Projeto open source
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <div className="mw-section-label">{label}</div>
      {children}
    </label>
  );
}

const overlayStyle: CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};
const modalStyle: CSSProperties = {
  width: 400, borderRadius: 18, overflow: 'hidden',
  display: 'flex', flexDirection: 'column',
};
const headerRowStyle: CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px',
  borderBottom: '1px solid var(--node-border)',
};
const linkBtnStyle: CSSProperties = { background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: 14 };