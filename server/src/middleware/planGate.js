import pool from '../config/db.js';
import { isModuleAllowed } from '../config/plans.js';

// A appliquer apres `authenticate`. Bloque l'acces a un module si le forfait
// du commerce ne l'inclut pas (ex: "tables", "ingredients", "tournees", "clients").
export function requirePlanModule(moduleId) {
  return async (req, res, next) => {
    try {
      const result = await pool.query('SELECT plan FROM businesses WHERE id = $1', [req.user.businessId]);
      const plan = result.rows[0]?.plan;
      if (!isModuleAllowed(plan, moduleId)) {
        return res.status(403).json({ error: "Ce module n'est pas inclus dans votre forfait", code: 'PLAN_MODULE_LOCKED' });
      }
      next();
    } catch (err) {
      console.error('Plan gate error:', err);
      next(); // ne bloque pas l'acces sur une erreur technique
    }
  };
}
