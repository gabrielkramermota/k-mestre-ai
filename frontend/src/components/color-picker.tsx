export const ROLE_COLORS = [
  '#8b5cf6',
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#ec4899',
  '#06b6d4',
  '#a855f7',
];

export default function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {ROLE_COLORS.map(color => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          title={color}
          style={{
            width: 26,
            height: 26,
            borderRadius: 8,
            background: color,
            border: value === color ? '2px solid #fff' : '2px solid transparent',
            boxShadow: value === color ? `0 0 0 2px ${color}` : 'none',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        />
      ))}
    </div>
  );
}