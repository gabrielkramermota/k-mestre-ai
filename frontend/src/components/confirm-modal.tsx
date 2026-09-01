import type { CSSProperties } from 'react';

export default function ConfirmModal({
  title,
  message,
  confirmLabel = 'Excluir',
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div style={overlayStyle} onClick={onCancel}>
      <div style={modalStyle} className="glass-panel" onClick={e => e.stopPropagation()}>
        <div style={{ padding: '20px 20px 4px' }}>
          <strong style={{ fontSize: 15 }}>{title}</strong>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.5 }}>{message}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '16px 20px 20px', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={cancelBtnStyle}>Cancelar</button>
          <button onClick={onConfirm} style={dangerBtnStyle}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100,
};
const modalStyle: CSSProperties = { width: 340, borderRadius: 18, overflow: 'hidden' };
const cancelBtnStyle: CSSProperties = {
  background: 'rgba(255,255,255,0.06)', border: '1px solid var(--node-border)',
  color: 'var(--text-color)', borderRadius: 9, padding: '7px 14px', cursor: 'pointer', fontSize: 13,
  fontFamily: 'Inter, sans-serif',
};
const dangerBtnStyle: CSSProperties = {
  background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
  color: '#f87171', borderRadius: 9, padding: '7px 14px', cursor: 'pointer', fontSize: 13,
  fontFamily: 'Inter, sans-serif', fontWeight: 600,
};
