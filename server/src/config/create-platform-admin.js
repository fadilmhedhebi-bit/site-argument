import bcrypt from 'bcrypt';
import pool from './db.js';

// Usage : node src/config/create-platform-admin.js <email> <password> <prenom> <nom>
// Aucune inscription publique n'existe pour les comptes plateforme (acces a
// tous les commerces) : ce script est le seul moyen de creer le premier
// compte, a executer une fois manuellement (ou depuis un shell Render).
async function main() {
  const [email, password, firstName, lastName] = process.argv.slice(2);
  if (!email || !password || !firstName || !lastName) {
    console.error('Usage: node src/config/create-platform-admin.js <email> <password> <prenom> <nom>');
    process.exitCode = 1;
    return;
  }
  if (password.length < 8) {
    console.error('Le mot de passe doit contenir au moins 8 caractères');
    process.exitCode = 1;
    return;
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO platform_admins (email, password_hash, first_name, last_name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET password_hash = $2, first_name = $3, last_name = $4
       RETURNING id, email`,
      [email.trim().toLowerCase(), passwordHash, firstName, lastName]
    );
    console.log(`Compte super-admin prêt : ${result.rows[0].email} (${result.rows[0].id})`);
  } catch (err) {
    console.error('Erreur lors de la création du compte:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
