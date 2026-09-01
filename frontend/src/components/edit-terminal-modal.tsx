import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Field, ToggleField } from './terminal-launch-modal';

export interface EditTerminalValues {
  label: string;
  monitorActivity: boolean;
  isMaestro: boolean;
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

  return (
    <div style={overlayStyle}>
      <div style={modalStyle} className="glass-panel">
        <div style={headerRowStyle}>
          <button onClick={onCancel} style={linkBtnStyle}>Cancelar</button>
          <strong>Editar terminal</strong>
          <button
            onClick={() => onSave({ label: label.trim() || 'Terminal', monitorActivity, isMaestro })}
            style={{ ...linkBtnStyle, fontWeight: 600 }}
          >
            Salvar
          </button>
        </div>

        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Field label="Nome do terminal">
            <input value={label} onChange={e => setLabel(e.target.value)} className="mw-input" autoFocus />
          </Field>
          <ToggleField
            label="Monitorar atividade"
            description="Detecta a saída do terminal e avisa quando o trabalho termina."
            checked={monitorActivity}
            onChange={setMonitorActivity}
          />
          <ToggleField
            label="Maestro"
            description="Promove este terminal a maestro, capaz de reger o restante do canvas. Use Recarregar para aplicar."
            checked={isMaestro}
            onChange={setIsMaestro}
          />
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
