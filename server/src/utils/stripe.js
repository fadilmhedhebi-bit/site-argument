import Stripe from 'stripe';

// STRIPE_SECRET_KEY est absent en dev/tant que le compte Stripe n'est pas
// cree : on exporte quand meme un client (Stripe() accepte une cle vide),
// les routes de facturation renverront une erreur explicite a l'usage plutot
// que de faire planter tout le serveur au demarrage.
// Pas d'apiVersion explicite : on utilise celle embarquee par le SDK.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');

export const STRIPE_PRICE_BY_PLAN = {
  starter: process.env.STRIPE_PRICE_STARTER || null,
  standard: process.env.STRIPE_PRICE_STANDARD || null,
  premium: process.env.STRIPE_PRICE_PREMIUM || null,
};
export const STRIPE_PRICE_EQUIPMENT = process.env.STRIPE_PRICE_EQUIPMENT || null;
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || null;

export function isStripeConfigured() {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
    STRIPE_PRICE_BY_PLAN.starter && STRIPE_PRICE_BY_PLAN.standard && STRIPE_PRICE_BY_PLAN.premium
  );
}
