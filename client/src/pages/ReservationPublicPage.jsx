import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import BusinessLogo from '../components/BusinessLogo';
import PageSpinner from '../components/PageSpinner';
import { useTheme } from '../ThemeContext';

const statusLabels = { confirmed: 'Confirmée', cancelled: 'Annulée', completed: 'Terminée', no_show: 'Non présenté' };

export default function ReservationPublicPage() {
  const { reservationNumber } = useParams();
  const { t } = useTheme();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const base = (import.meta.env.VITE_API_URL || '') + '/api';
    fetch(`${base}/reservations/public/${reservationNumber}`)
      .then(r => r.ok ? r.json() : r.json().then(d => Promise.reject(d.error)))
      .then(setData)
      .catch(err => setError(typeof err === 'string' ? err : 'Réservation introuvable'))
      .finally(() => setLoading(false));
  }, [reservationNumber]);

  if (loading) return <PageSpinner />;

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: t.bg }}>
        <div className="rounded-2xl p-8 max-w-md w-full text-center" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}` }}>
          <BusinessLogo size={40} />
          <h1 className="text-xl font-bold mt-4" style={{ color: t.text1 }}>Réservation introuvable</h1>
          <p className="mt-2" style={{ color: t.text2 }}>{error}</p>
        </div>
      </div>
    );
  }

  const isActive = data.status === 'confirmed';

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: t.bg }}>
      <div className="rounded-2xl w-full max-w-md overflow-hidden" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}` }}>
        <div className="px-6 py-5 text-center" style={{ backgroundColor: data.primary_color || t.accent }}>
          <BusinessLogo logoUrl={data.logo_url} size={36} />
          <h1 className="text-lg font-bold text-white mt-2">{data.business_name}</h1>
        </div>

        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-xs uppercase tracking-wider" style={{ color: t.text3 }}>Réservation</p>
              <p className="text-lg font-mono font-bold" style={{ color: t.text1 }}>{data.reservation_number}</p>
            </div>
            <span
              className="px-3 py-1 rounded-full text-xs font-semibold"
              style={isActive ? { backgroundColor: t.greenBg, color: t.greenText } : { backgroundColor: t.tabBg, color: t.text2 }}
            >
              {statusLabels[data.status]}
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-xs" style={{ color: t.text3 }}>Nom</p>
              <p className="font-semibold" style={{ color: t.text1 }}>{data.customer_first_name} {data.customer_last_name}</p>
            </div>

            <div>
              <p className="text-xs" style={{ color: t.text3 }}>Date</p>
              <p className="font-semibold" style={{ color: t.text1 }}>{new Date(data.reservation_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>

            <div>
              <p className="text-xs" style={{ color: t.text3 }}>Heure</p>
              <p className="font-semibold" style={{ color: t.text1 }}>{data.reservation_time.slice(0, 5)}</p>
            </div>

            <div>
              <p className="text-xs" style={{ color: t.text3 }}>Nombre de personnes</p>
              <p className="font-semibold" style={{ color: t.text1 }}>{data.party_size} personne{data.party_size > 1 ? 's' : ''}</p>
            </div>

            {data.business_address && (
              <div>
                <p className="text-xs" style={{ color: t.text3 }}>Adresse</p>
                <p className="font-semibold" style={{ color: t.text1 }}>{data.business_address}</p>
              </div>
            )}

            {data.business_phone && (
              <div>
                <p className="text-xs" style={{ color: t.text3 }}>Telephone</p>
                <a href={`tel:${data.business_phone}`} className="font-semibold" style={{ color: data.primary_color || t.accent }}>{data.business_phone}</a>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 text-center" style={{ backgroundColor: t.tabBg, borderTop: `1px solid ${t.border}` }}>
          <p className="text-xs" style={{ color: t.text3 }}>Powered by RestoLab</p>
        </div>
      </div>
    </div>
  );
}
