export const PLANS = ['starter', 'standard', 'premium'];
export const DEFAULT_PLAN = 'starter';

// Nombre max de comptes livreur + equipier (hors gestionnaire) creables pour ce forfait.
export const PLAN_TEAM_LIMITS = {
  starter: 2,
  standard: 6,
  premium: Infinity,
};

// Modules geres par forfait ; un module absent de la liste est bloque cote API (403)
// et masque cote interface pour ce forfait.
export const PLAN_MODULES = {
  starter: ['commandes', 'reservations', 'caisse', 'menu', 'stats', 'historique', 'equipe'],
  standard: ['commandes', 'reservations', 'caisse', 'menu', 'stats', 'historique', 'equipe', 'tournees', 'clients'],
  premium: ['commandes', 'reservations', 'caisse', 'menu', 'stats', 'historique', 'equipe', 'tournees', 'clients', 'tables', 'ingredients'],
};

export function normalizePlan(plan) {
  return PLANS.includes(plan) ? plan : DEFAULT_PLAN;
}

export function teamLimitFor(plan) {
  return PLAN_TEAM_LIMITS[normalizePlan(plan)];
}

export function isModuleAllowed(plan, moduleId) {
  return PLAN_MODULES[normalizePlan(plan)].includes(moduleId);
}
