export default function FoodlyLogo({ size = 30 }) {
  const radii = { 20: 6, 30: 9, 32: 9, 48: 14, 72: 20, 88: 24, 104: 28 };
  const br = radii[size] || Math.round(size * 0.27);

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: br,
        background: 'linear-gradient(160deg, #1C8275, #0D5650)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <svg
        viewBox="0 0 44 50"
        style={{ width: size * 0.6, height: size * 0.68 }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="28" cy="16" r="16" fill="#3140A8" />
        <line x1="25" y1="4" x2="25" y2="14" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" />
        <line x1="28" y1="4" x2="28" y2="14" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" />
        <line x1="31" y1="4" x2="31" y2="14" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" />
        <ellipse cx="16" cy="34" rx="16" ry="15" fill="#9472D4" />
        <line x1="12" y1="34" x2="20" y2="34" stroke="rgba(255,255,255,0.28)" strokeWidth="1.5" />
        <line x1="16" y1="30" x2="16" y2="38" stroke="rgba(255,255,255,0.28)" strokeWidth="1.5" />
      </svg>
    </div>
  );
}
