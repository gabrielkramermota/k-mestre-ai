import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { toast } from 'sonner';
import { Bot, Code2, Sparkles, TerminalSquare } from 'lucide-react';
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

const STORAGE_KEY = 'maestri:lastTerminalChoice';

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
      toast.error('Escolha um diretório de trabalho.');
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
      <div style={modalStyle} className="glass-panel">
        <div style={headerRowStyle}>
          <button onClick={onCancel} style={linkBtnStyle}>Cancelar</button>
          <strong>Novo terminal</strong>
          <button onClick={handleConfirm} style={{ ...linkBtnStyle, fontWeight: 600 }}>Criar</button>
        </div>

        <div style={{ padding: '14px 18px 10px' }}>
          <div className="mw-section-label">Início rápido</div>
          <div style={{ display: 'flex', gap: 10 }}>
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

        <div className="mw-tabs">
          <button className={`mw-tab${tab === 'detalhes' ? ' active' : ''}`} onClick={() => setTab('detalhes')}>Detalhes</button>
          <button className={`mw-tab${tab === 'agente' ? ' active' : ''}`} onClick={() => setTab('agente')}>Agente</button>
        </div>

        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {tab === 'detalhes' ? (
            <>
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
                    style={{ flex: 1 }}
                  />
                  <button onClick={handlePickFolder} disabled={picking} className="mw-secondary-btn">
                    {picking ? '...' : 'Procurar...'}
                  </button>
                </div>
              </Field>
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
                  style={{ minHeight: 140, resize: 'vertical' }}
                />
              </Field>
            </>
          )}
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
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};
const modalStyle: CSSProperties = {
  width: 420, maxHeight: '88vh', borderRadius: 18, overflow: 'hidden',
  display: 'flex', flexDirection: 'column',
};
const headerRowStyle: CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px',
  borderBottom: '1px solid var(--node-border)',
};
const linkBtnStyle: CSSProperties = { background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: 14 };