import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { toast } from 'sonner';
import { Bot, Code2, Network, Sparkles, TerminalSquare, X } from 'lucide-react';
import { pickFolder } from '../api';

export interface TerminalLaunchChoice {
  label: string;
  shell: 'powershell' | 'cmd';
  aiCommand?: string;
  workingDirectory: string;
  monitorActivity: boolean;
  isMaestro: boolean;
  roleName: string;
  rolePrompt: string;
}

const QUICK_START = [
  { label: 'Claude Code', command: 'claude', icon: Sparkles },
  { label: 'Codex', command: 'codex', icon: Code2 },
  { label: 'OpenCode', command: 'opencode', icon: Bot },
  { label: 'Shell', command: '', icon: TerminalSquare },
] as const;

const STORAGE_KEY = 'kmestre:lastTerminalChoice';

function loadDefaultShell(): 'powershell' | 'cmd' {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.shell === 'cmd' || parsed.shell === 'powershell') return parsed.shell;
    }
  } catch {
    // localStorage indisponivel ou conteudo invalido - usa o default
  }
  return 'powershell';
}

export default function TerminalLaunchModal({
  onCancel,
  onConfirm,
  defaultWorkingDirectory,
}: {
  onCancel: () => void;
  onConfirm: (choice: TerminalLaunchChoice) => void;
  defaultWorkingDirectory?: string;
}) {
  const [tab, setTab] = useState<'detalhes' | 'agente'>('detalhes');
  const [name, setName] = useState('Terminal');
  const [command, setCommand] = useState('');
  const [shell, setShell] = useState<'powershell' | 'cmd'>(loadDefaultShell());
  const [workingDirectory, setWorkingDirectory] = useState(defaultWorkingDirectory || '');
  const [monitorActivity, setMonitorActivity] = useState(true);
  const [isMaestro, setIsMaestro] = useState(false);
  const [roleName, setRoleName] = useState('');
  const [rolePrompt, setRolePrompt] = useState('');
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const handlePickFolder = async () => {
    setPicking(true);
    try {
      const picked = await pickFolder();
      if (picked) setWorkingDirectory(picked);
    } finally {
      setPicking(false);
    }
  };

  const handleConfirm = () => {
    if (!workingDirectory.trim()) {
      toast.error('Escolha um diretório de trabalho para o terminal.');
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ shell }));
    } catch {
      // localStorage indisponivel - segue sem lembrar o default
    }
    onConfirm({
      label: name.trim() || 'Terminal',
      shell,
      aiCommand: command.trim() || undefined,
      workingDirectory: workingDirectory.trim(),
      monitorActivity,
      isMaestro,
      roleName: roleName.trim(),
      rolePrompt: rolePrompt.trim(),
    });
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle} className="km-modal">
        <div style={brandHeaderStyle}>
          <div style={brandGlow} />
          <div style={brandHeaderText}>
            <span style={brandBadge}><Network size={13} /> K-Mestre</span>
            <div style={brandTitle}>Novo terminal</div>
          </div>
          <button onClick={onCancel} style={closeBtnStyle} aria-label="Fechar"><X size={18} /></button>
        </div>

        <div style={bodyStyle}>
          <div style={{ padding: '14px 18px 14px', flexShrink: 0 }}>
            <div className="mw-section-label">Agente</div>
            <div className="km-quickstart-grid">
              {QUICK_START.map(q => (
                <button
                  key={q.label}
                  onClick={() => { setName(q.label); setCommand(q.command); }}
                  className={`mw-quickstart${command === q.command && name === q.label ? ' active' : ''}`}
                >
                  <q.icon size={20} />
                  <span style={{ fontSize: 11 }}>{q.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mw-tabs" style={{ flexShrink: 0 }}>
            <button className={`mw-tab${tab === 'detalhes' ? ' active' : ''}`} onClick={() => setTab('detalhes')}>Detalhes</button>
            <button className={`mw-tab${tab === 'agente' ? ' active' : ''}`} onClick={() => setTab('agente')}>Agente</button>
          </div>

          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14, flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {tab === 'detalhes' ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                  <Field label="Nome do terminal">
                    <input value={name} onChange={e => setName(e.target.value)} className="mw-input" />
                  </Field>
                  <Field label="Comando">
                    <input
                      value={command}
                      onChange={e => setCommand(e.target.value)}
                      placeholder="ex.: claude, codex, ou deixe vazio para shell"
                      className="mw-input"
                    />
                  </Field>
                  <Field label="Shell">
                    <select value={shell} onChange={e => setShell(e.target.value as 'powershell' | 'cmd')} className="mw-input">
                      <option value="powershell">PowerShell</option>
                      <option value="cmd">CMD</option>
                    </select>
                  </Field>
                  <Field label="Diretório de trabalho">
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        value={workingDirectory}
                        onChange={e => setWorkingDirectory(e.target.value)}
                        className="mw-input"
                        style={{ flex: 1, minWidth: 0 }}
                      />
                      <button onClick={handlePickFolder} disabled={picking} className="mw-secondary-btn">
                        {picking ? '...' : 'Procurar...'}
                      </button>
                    </div>
                  </Field>
                </div>
                <ToggleField
                  label="Monitorar atividade"
                  description="Detecta a saída do terminal e avisa quando o trabalho termina."
                  checked={monitorActivity}
                  onChange={setMonitorActivity}
                />
                <ToggleField
                  label="Maestro"
                  description="Promove este terminal a maestro, capaz de reger o restante do canvas."
                  checked={isMaestro}
                  onChange={setIsMaestro}
                />
              </>
            ) : (
              <>
                <Field label="Nome do papel (ex: DESIGN)">
                  <input value={roleName} onChange={e => setRoleName(e.target.value)} className="mw-input" />
                </Field>
                <Field label="Prompt do papel">
                  <textarea
                    value={rolePrompt}
                    onChange={e => setRolePrompt(e.target.value)}
                    className="mw-input"
                    style={{ minHeight: 110, resize: 'vertical' }}
                  />
                </Field>
              </>
            )}
          </div>

          <div style={footerStyle}>
            <button onClick={onCancel} style={cancelBtnStyle}>Cancelar</button>
            <button onClick={handleConfirm} style={createBtnStyle}>
              <TerminalSquare size={16} />
              Criar terminal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <div className="mw-section-label">{label}</div>
      {children}
    </label>
  );
}

export function ToggleField({
  label, description, checked, onChange,
}: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{description}</div>
      </div>
      <label className="mw-switch">
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
        <span className="mw-switch-slider"></span>
      </label>
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  backdropFilter: 'blur(4px)',
};
const modalStyle: CSSProperties = {
  width: 560, maxHeight: '88vh', borderRadius: 20, overflow: 'hidden',
  display: 'flex', flexDirection: 'column',
  background: '#15181f',
  border: '1px solid rgba(255,255,255,0.1)',
  boxShadow: '0 30px 70px -20px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)',
};
const brandHeaderStyle: CSSProperties = {
  flexShrink: 0,
  position: 'relative', overflow: 'hidden',
  background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #6d28d9 100%)',
  color: '#e0e7ff', padding: '14px 20px 12px',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
};
const brandGlow: CSSProperties = {
  position: 'absolute', top: -70, right: -40, width: 240, height: 240,
  borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.16), transparent 65%)',
  filter: 'blur(2px)',
};
const brandHeaderText: CSSProperties = { position: 'relative', display: 'flex', flexDirection: 'column', gap: 8 };
const brandBadge: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
  fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
  background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
  padding: '4px 10px', borderRadius: 999,
};
const brandTitle: CSSProperties = { fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.15 };
const bodyStyle: CSSProperties = {
  minHeight: 0, overflow: 'hidden',
  flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0,
};
const closeBtnStyle: CSSProperties = {
  position: 'relative', zIndex: 1,
  background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
  color: '#e0e7ff', borderRadius: 9, width: 30, height: 30,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', transition: 'all 0.15s',
};
const footerStyle: CSSProperties = {
  flexShrink: 0,
  display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10,
  padding: '14px 18px', borderTop: '1px solid var(--node-border)',
  background: 'rgba(255,255,255,0.02)',
};
const cancelBtnStyle: CSSProperties = {
  background: 'transparent', border: '1px solid var(--node-border)', color: 'var(--text-muted)',
  borderRadius: 10, padding: '9px 16px', fontSize: 13, cursor: 'pointer',
  fontFamily: 'Inter, sans-serif', transition: 'all 0.15s',
};
const createBtnStyle: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 8,
  background: 'linear-gradient(135deg, #7c3aed, #a855f7)', border: 'none',
  color: '#fff', borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'Inter, sans-serif',
  boxShadow: '0 8px 20px -6px rgba(124,58,237,0.55)',
  transition: 'transform 0.12s, box-shadow 0.15s',
};
