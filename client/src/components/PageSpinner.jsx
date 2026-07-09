import { useTheme } from '../ThemeContext';

export default function PageSpinner({ minHeight = '100vh' }) {
  const { t } = useTheme();
  return (
    <div className="flex items-center justify-center" style={{ backgroundColor: t.bg, minHeight }}>
      <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: t.border, borderTopColor: t.accent }} />
    </div>
  );
}
