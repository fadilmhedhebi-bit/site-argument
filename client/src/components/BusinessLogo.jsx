import RestoLabLogo from './RestoLabLogo';

const API_ORIGIN = (import.meta.env.VITE_API_URL || '');

// Affiche le logo uploade par le commerce si disponible, sinon retombe sur
// le symbole RestoLab generique - utilise sur toutes les pages cote client
// final (le client d'un restaurant ne doit jamais voir "RestoLab" comme
// identite visuelle principale, seulement le commerce chez qui il commande).
export default function BusinessLogo({ logoUrl, size = 30 }) {
  if (!logoUrl) return <RestoLabLogo size={size} />;

  const src = logoUrl.startsWith('http') ? logoUrl : `${API_ORIGIN}${logoUrl}`;
  return (
    <img
      src={src}
      alt=""
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.27), objectFit: 'cover', flexShrink: 0 }}
    />
  );
}
