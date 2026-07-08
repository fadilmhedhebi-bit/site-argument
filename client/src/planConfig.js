export const PLAN_TEAM_LIMITS = { starter: 2, standard: 6, premium: Infinity };

export const PLAN_MODULES = {
  starter: ['commandes', 'reservations', 'caisse', 'menu', 'stats', 'historique', 'equipe'],
  standard: ['commandes', 'reservations', 'caisse', 'menu', 'stats', 'historique', 'equipe', 'tournees', 'clients'],
  premium: ['commandes', 'reservations', 'caisse', 'menu', 'stats', 'historique', 'equipe', 'tournees', 'clients', 'tables', 'ingredients', 'integrations'],
};

export const PLAN_INFO = [
  {
    id: 'starter',
    label: 'Starter',
    tagline: 'Pour démarrer',
    features: [
      '2 comptes livreur/équipier',
      'Commandes, caisse, menu, réservations',
      'Statistiques de base',
    ],
  },
  {
    id: 'standard',
    label: 'Standard',
    tagline: 'Le plus populaire',
    features: [
      '6 comptes livreur/équipier',
      'Tout Starter',
      '+ Gestion des tournées de livraison',
      '+ Fidélité clients',
    ],
  },
  {
    id: 'premium',
    label: 'Premium',
    tagline: 'Sans limites',
    features: [
      'Comptes illimités',
      'Tout Standard',
      '+ Plan de salle interactif',
      '+ Gestion des stocks/ingrédients',
    ],
  },
];

export function isModuleAllowed(plan, moduleId) {
  return (PLAN_MODULES[plan] || PLAN_MODULES.starter).includes(moduleId);
}

export function teamLimitFor(plan) {
  return PLAN_TEAM_LIMITS[plan] ?? PLAN_TEAM_LIMITS.starter;
}
