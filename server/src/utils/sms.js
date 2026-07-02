const APP_URL = process.env.APP_URL || 'http://localhost:5173';

export async function sendReservationSMS(phone, reservation, business) {
  const link = `${APP_URL}/reservation/${reservation.reservation_number}`;
  const message = [
    `Foodly - Confirmation de réservation`,
    `N° ${reservation.reservation_number}`,
    `${reservation.customer_first_name} ${reservation.customer_last_name}`,
    `Date : ${new Date(reservation.reservation_date).toLocaleDateString('fr-FR')}`,
    `Heure : ${reservation.reservation_time.slice(0, 5)}`,
    `Personnes : ${reservation.party_size}`,
    business.address ? `Adresse : ${business.address}` : '',
    `Détails : ${link}`,
  ].filter(Boolean).join('\n');

  if (process.env.SMS_PROVIDER === 'twilio') {
    try {
      const twilio = await import('twilio');
      const client = twilio.default(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
      await client.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE,
        to: phone,
      });
      return;
    } catch (err) {
      console.error('[SMS] Twilio error:', err.message);
    }
  }

  console.log(`[SMS] To: ${phone}`);
  console.log(`[SMS] ${message}`);
}
