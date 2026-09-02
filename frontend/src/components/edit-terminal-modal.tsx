import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Field, ToggleField } from './terminal-launch-modal';
import ColorPicker from './color-picker';

export interface EditTerminalValues {
  label: string;
  monitorActivity: boolean;
  isMaestro: boolean;
  aiCommand: string;
  shell: 'powershell' | 'cmd';
  workingDirectory: string;
  roleName: string;
  rolePrompt: string;
  roleColor: string;
}

export default function EditTerminalModal({
  initial,
  onCancel,
  onSave,
}: {
  initial: EditTerminalValues;
  onCancel: () => void;
  onSave: (values: EditTerminalValues) => void;
}) {
  const [label, setLabel] = useState(initial.label);
  const [monitorActivity, setMonitorActivity] = useState(initial.monitorActivity);
  const [isMaestro, setIsMaestro] = useState(initial.isMaestro);
  const [aiCommand, setAiCommand] = useState(initial.aiCommand);
  const [shell, setShell] = useState(initial.shell);
  const [workingDirectory, setWorkingDirectory] = useState(initial.workingDirectory);
  const [roleName, setRoleName] = useState(initial.roleName);
  const [rolePrompt, setRolePrompt] = useState(initial.rolePrompt);
  const [roleColor, setRoleColor] = useState(initial.roleColor);

  return (
    <div style={overlayStyle}>
      <div style={modalStyle} className="glass-panel">
        <div style={headerRowStyle}>
          <button onClick={onCancel} style={linkBtnStyle}>Cancelar</button>
          <strong>Editar terminal</strong>
          <button
            onClick={() => onSave({
              label: label.trim() || 'Terminal',
              monitorActivity,
              isMaestro,
              aiCommand,
              shell,
              workingDirectory: workingDirectory.trim(),
              roleName: roleName.trim(),
              rolePrompt: rolePrompt.trim(),
              roleColor,
            })}
            style={{ ...linkBtnStyle, fontWeight: 600 }}
          >
            Salvar
          </button>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14, flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <div style={grid2Style}>
            <Field label="Nome do terminal">
              <input value={label} onChange={e => setLabel(e.target.value)} className="mw-input" autoFocus />
            </Field>
            <Field label="Comando">
              <input
                value={aiCommand}
                onChange={e => setAiCommand(e.target.value)}
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
              <input value={workingDirectory} onChange={e => setWorkingDirectory(e.target.value)} className="mw-input" />
            </Field>
            <Field label="Nome do papel (ex: DESIGN)">
              <input value={roleName} onChange={e => setRoleName(e.target.value)} className="mw-input" />
            </Field>
            <Field label="Cor do papel">
              <ColorPicker value={roleColor} onChange={setRoleColor} />
            </Field>
          </div>
          <Field label="Prompt do papel">
            <textarea
              value={rolePrompt}
              onChange={e => setRolePrompt(e.target.value)}
              className="mw-input"
              style={{ minHeight: 90, resize: 'vertical' }}
            />
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
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Alterações de comando, shell, diretório ou papel reiniciam o terminal para aplicar.
          </div>
        </div>
      </div>
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};
const modalStyle: CSSProperties = {
  width: 520, maxHeight: '88vh', borderRadius: 18, overflow: 'hidden',
  display: 'flex', flexDirection: 'column',
};
const grid2Style: CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14,
};
const headerRowStyle: CSSProperties = {
  flexShrink: 0,
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px',
  borderBottom: '1px solid var(--node-border)',
};
const linkBtnStyle: CSSProperties = { background: 'none', border: 'none', color: '#8b5cf6', cursor: 'pointer', fontSize: 14 };