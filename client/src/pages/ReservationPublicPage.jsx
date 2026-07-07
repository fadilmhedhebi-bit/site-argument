import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import RestoLabLogo from '../components/RestoLabLogo';

const statusLabels = { confirmed: 'Confirmée', cancelled: 'Annulée', completed: 'Terminée', no_show: 'Non présenté' };

export default function ReservationPublicPage() {
  const { reservationNumber } = useParams();
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Chargement...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <RestoLabLogo size={40} />
          <h1 className="text-xl font-bold mt-4 text-gray-800">Réservation introuvable</h1>
          <p className="text-gray-500 mt-2">{error}</p>
        </div>
      </div>
    );
  }

  const isActive = data.status === 'confirmed';

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#f5f7f5' }}>
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md overflow-hidden">
        <div className="px-6 py-5 text-center" style={{ backgroundColor: '#5C6B3C' }}>
          <RestoLabLogo size={36} color="#fff" />
          <h1 className="text-lg font-bold text-white mt-2">{data.business_name}</h1>
        </div>

        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">Réservation</p>
              <p className="text-lg font-mono font-bold text-gray-800">{data.reservation_number}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {statusLabels[data.status]}
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-400">Nom</p>
              <p className="font-semibold text-gray-800">{data.customer_first_name} {data.customer_last_name}</p>
            </div>

            <div>
              <p className="text-xs text-gray-400">Date</p>
              <p className="font-semibold text-gray-800">{new Date(data.reservation_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>

            <div>
              <p className="text-xs text-gray-400">Heure</p>
              <p className="font-semibold text-gray-800">{data.reservation_time.slice(0, 5)}</p>
            </div>

            <div>
              <p className="text-xs text-gray-400">Nombre de personnes</p>
              <p className="font-semibold text-gray-800">{data.party_size} personne{data.party_size > 1 ? 's' : ''}</p>
            </div>

            {data.business_address && (
              <div>
                <p className="text-xs text-gray-400">Adresse</p>
                <p className="font-semibold text-gray-800">{data.business_address}</p>
              </div>
            )}

            {data.business_phone && (
              <div>
                <p className="text-xs text-gray-400">Telephone</p>
                <a href={`tel:${data.business_phone}`} className="font-semibold" style={{ color: '#5C6B3C' }}>{data.business_phone}</a>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 text-center" style={{ backgroundColor: '#f9fafb', borderTop: '1px solid #e5e7eb' }}>
          <p className="text-xs text-gray-400">Powered by RestoLab</p>
        </div>
      </div>
    </div>
  );
}
