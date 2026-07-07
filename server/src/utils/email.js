// Envoi via l'API HTTP de Brevo (https://api.brevo.com) plutot que SMTP :
// les plateformes cloud (dont Render) bloquent les connexions SMTP sortantes
// (port 587/465/25) par mesure anti-spam, l'API REST passe par HTTPS (443)
// qui n'est jamais bloque.
const BREVO_API_KEY = process.env.BREVO_API_KEY || null;
const FROM_EMAIL = process.env.SMTP_FROM_EMAIL || 'noreply@restolab.app';
const FROM_NAME = process.env.SMTP_FROM_NAME || 'RestoLab';
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

async function send(to, subject, html) {
  if (!BREVO_API_KEY) {
    console.log(`[EMAIL] To: ${to} | Subject: ${subject}`);
    console.log(`[EMAIL] Body: ${html.replace(/<[^>]*>/g, '')}`);
    return;
  }

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'api-key': BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: { email: FROM_EMAIL, name: FROM_NAME },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Brevo API error ${res.status}: ${body}`);
  }
}

export async function sendVerificationEmail(email, token, firstName) {
  const link = `${APP_URL}/verify-email?token=${token}`;
  await send(email, 'Confirmez votre adresse email — RestoLab', `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#5C6B3C">Bienvenue sur RestoLab, ${firstName} !</h2>
      <p>Pour activer votre compte, veuillez confirmer votre adresse email en cliquant sur le bouton ci-dessous :</p>
      <a href="${link}" style="display:inline-block;background:#5C6B3C;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">
        Confirmer mon email
      </a>
      <p style="font-size:13px;color:#888">Ou copiez ce lien : ${link}</p>
      <p style="font-size:13px;color:#888">Ce lien expire dans 24 heures.</p>
    </div>
  `);
}

export async function sendCustomerVerificationEmail(email, token, firstName, businessId) {
  const link = `${APP_URL}/client/${businessId}?verify=${token}`;
  await send(email, 'Confirmez votre adresse email — RestoLab', `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#5C6B3C">Bienvenue sur RestoLab, ${firstName} !</h2>
      <p>Pour activer votre compte client, veuillez confirmer votre adresse email :</p>
      <a href="${link}" style="display:inline-block;background:#5C6B3C;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">
        Confirmer mon email
      </a>
      <p style="font-size:13px;color:#888">Ou copiez ce lien : ${link}</p>
      <p style="font-size:13px;color:#888">Ce lien expire dans 24 heures.</p>
    </div>
  `);
}

export async function sendPasswordResetEmail(email, token, firstName) {
  const link = `${APP_URL}/reset-password?token=${token}`;
  await send(email, 'Réinitialisation de mot de passe — RestoLab', `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#5C6B3C">Réinitialisation de mot de passe</h2>
      <p>Bonjour ${firstName},</p>
      <p>Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous :</p>
      <a href="${link}" style="display:inline-block;background:#5C6B3C;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">
        Réinitialiser mon mot de passe
      </a>
      <p style="font-size:13px;color:#888">Ce lien expire dans 1 heure.</p>
      <p style="font-size:13px;color:#888">Si vous n'avez pas fait cette demande, ignorez cet email.</p>
    </div>
  `);
}

export async function sendCustomerPasswordResetEmail(email, token, firstName, businessId) {
  const link = `${APP_URL}/client/${businessId}?reset=${token}`;
  await send(email, 'Réinitialisation de mot de passe — RestoLab', `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#5C6B3C">Réinitialisation de mot de passe</h2>
      <p>Bonjour ${firstName},</p>
      <p>Vous avez demandé la réinitialisation de votre mot de passe :</p>
      <a href="${link}" style="display:inline-block;background:#5C6B3C;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">
        Réinitialiser mon mot de passe
      </a>
      <p style="font-size:13px;color:#888">Ce lien expire dans 1 heure.</p>
      <p style="font-size:13px;color:#888">Si vous n'avez pas fait cette demande, ignorez cet email.</p>
    </div>
  `);
}
