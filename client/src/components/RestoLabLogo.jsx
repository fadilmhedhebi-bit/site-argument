export default function RestoLabLogo({ size = 30 }) {
  const radii = { 20: 6, 30: 9, 32: 9, 48: 14, 72: 20, 88: 24, 104: 28 };
  const br = radii[size] || Math.round(size * 0.27);

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: br,
        background: 'linear-gradient(150deg, #5C6B3C, #3A4427)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <svg
        viewBox="0 0 44 44"
        style={{ width: size * 0.62, height: size * 0.62 }}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
      >
        <path d="M19 16V10H25V16" stroke="#D4AF37" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        <rect x="18" y="7" width="8" height="3" rx="1.5" fill="none" stroke="#D4AF37" strokeWidth="1.5" />
        <ellipse cx="22" cy="28" rx="14" ry="12" fill="none" stroke="#D4AF37" strokeWidth="1.8" />
        <path d="M19 16C17 18 10 22 10 28" stroke="#D4AF37" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        <path d="M25 16C27 18 34 22 34 28" stroke="#D4AF37" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        <ellipse cx="22" cy="30" rx="11" ry="8" fill="#D4AF37" opacity=".3" />
        <circle cx="20" cy="28" r="1.5" fill="rgba(255,255,255,.5)" />
        <circle cx="25" cy="30" r="1" fill="rgba(255,255,255,.4)" />
      </svg>
    </div>
  );
}
