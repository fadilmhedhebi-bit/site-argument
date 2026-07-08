import crypto from 'crypto';

// Cles d'application (une seule fois pour toute la plateforme RestoLab, pas
// par commerce) : Uber Eats et Deliveroo homologuent un seul partenaire
// technique ; chaque restaurant "connecte" ensuite sa propre boutique via
// OAuth une fois ce partenariat approuve. Absentes tant que ce n'est pas le
// cas - les routes concernees repondent alors une erreur explicite plutot
// que de planter au demarrage du serveur.
export const UBER_EATS_CLIENT_ID = process.env.UBER_EATS_CLIENT_ID || null;
export const UBER_EATS_CLIENT_SECRET = process.env.UBER_EATS_CLIENT_SECRET || null;
export const UBER_EATS_WEBHOOK_SECRET = process.env.UBER_EATS_WEBHOOK_SECRET || null;

export const DELIVEROO_CLIENT_ID = process.env.DELIVEROO_CLIENT_ID || null;
export const DELIVEROO_CLIENT_SECRET = process.env.DELIVEROO_CLIENT_SECRET || null;
export const DELIVEROO_WEBHOOK_SECRET = process.env.DELIVEROO_WEBHOOK_SECRET || null;

export function isUberEatsConfigured() {
  return Boolean(UBER_EATS_CLIENT_ID && UBER_EATS_CLIENT_SECRET && UBER_EATS_WEBHOOK_SECRET);
}

export function isDeliverooConfigured() {
  return Boolean(DELIVEROO_CLIENT_ID && DELIVEROO_CLIENT_SECRET && DELIVEROO_WEBHOOK_SECRET);
}

function timingSafeEqualHex(expectedHex, receivedHex) {
  const a = Buffer.from(expectedHex, 'hex');
  const b = Buffer.from(String(receivedHex || '').toLowerCase(), 'hex');
  if (a.length === 0 || a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Uber Eats signe chaque webhook avec un HMAC-SHA256 (hexadecimal, minuscules)
// du corps brut de la requete, cle = client secret, transmis dans l'en-tete
// X-Uber-Signature. https://developer.uber.com/docs/eats/guides/webhooks
export function verifyUberEatsSignature(rawBody, signatureHeader) {
  if (!signatureHeader || !UBER_EATS_WEBHOOK_SECRET) return false;
  const expected = crypto.createHmac('sha256', UBER_EATS_WEBHOOK_SECRET).update(rawBody).digest('hex');
  return timingSafeEqualHex(expected, signatureHeader);
}

// Deliveroo signe chaque webhook avec un HMAC-SHA256 du GUID de sequence
// concatene au corps brut (separateur espace pour les evenements recents),
// cle = secret webhook, transmis dans les en-tetes X-Deliveroo-Sequence-Guid
// et X-Deliveroo-Hmac-Sha256. Encodage et separateur exact a reconfirmer sur
// le compte partenaire une fois l'acces obtenu (doc: legacy new_order/
// cancel_order utilisent un saut de ligne au lieu d'un espace).
// https://api-docs.deliveroo.com/docs/securing-webhooks
export function verifyDeliverooSignature(rawBody, guid, signatureHeader) {
  if (!signatureHeader || !guid || !DELIVEROO_WEBHOOK_SECRET) return false;
  const message = Buffer.concat([Buffer.from(String(guid)), Buffer.from(' '), rawBody]);
  const expected = crypto.createHmac('sha256', DELIVEROO_WEBHOOK_SECRET).update(message).digest('hex');
  return timingSafeEqualHex(expected, signatureHeader);
}
