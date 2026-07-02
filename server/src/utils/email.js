import nodemailer from 'nodemailer';

const transporter = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  : null;

const FROM = process.env.SMTP_FROM || 'Foodly <noreply@foodly.app>';
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

async function send(to, subject, html) {
  if (!transporter) {
    console.log(`[EMAIL] To: ${to} | Subject: ${subject}`);
    console.log(`[EMAIL] Body: ${html.replace(/<[^>]*>/g, '')}`);
    return;
  }
  await transporter.sendMail({ from: FROM, to, subject, html });
}

export async function sendVerificationEmail(email, token, firstName) {
  const link = `${APP_URL}/verify-email?token=${token}`;
  await send(email, 'Confirmez votre adresse email — Foodly', `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#1C8275">Bienvenue sur Foodly, ${firstName} !</h2>
      <p>Pour activer votre compte, veuillez confirmer votre adresse email en cliquant sur le bouton ci-dessous :</p>
      <a href="${link}" style="display:inline-block;background:#1C8275;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">
        Confirmer mon email
      </a>
      <p style="font-size:13px;color:#888">Ou copiez ce lien : ${link}</p>
      <p style="font-size:13px;color:#888">Ce lien expire dans 24 heures.</p>
    </div>
  `);
}

export async function sendCustomerVerificationEmail(email, token, firstName, businessId) {
  const link = `${APP_URL}/client/${businessId}?verify=${token}`;
  await send(email, 'Confirmez votre adresse email — Foodly', `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#1C8275">Bienvenue sur Foodly, ${firstName} !</h2>
      <p>Pour activer votre compte client, veuillez confirmer votre adresse email :</p>
      <a href="${link}" style="display:inline-block;background:#1C8275;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">
        Confirmer mon email
      </a>
      <p style="font-size:13px;color:#888">Ou copiez ce lien : ${link}</p>
      <p style="font-size:13px;color:#888">Ce lien expire dans 24 heures.</p>
    </div>
  `);
}

export async function sendPasswordResetEmail(email, token, firstName) {
  const link = `${APP_URL}/reset-password?token=${token}`;
  await send(email, 'Réinitialisation de mot de passe — Foodly', `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#1C8275">Réinitialisation de mot de passe</h2>
      <p>Bonjour ${firstName},</p>
      <p>Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous :</p>
      <a href="${link}" style="display:inline-block;background:#1C8275;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">
        Réinitialiser mon mot de passe
      </a>
      <p style="font-size:13px;color:#888">Ce lien expire dans 1 heure.</p>
      <p style="font-size:13px;color:#888">Si vous n'avez pas fait cette demande, ignorez cet email.</p>
    </div>
  `);
}

export async function sendCustomerPasswordResetEmail(email, token, firstName, businessId) {
  const link = `${APP_URL}/client/${businessId}?reset=${token}`;
  await send(email, 'Réinitialisation de mot de passe — Foodly', `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#1C8275">Réinitialisation de mot de passe</h2>
      <p>Bonjour ${firstName},</p>
      <p>Vous avez demandé la réinitialisation de votre mot de passe :</p>
      <a href="${link}" style="display:inline-block;background:#1C8275;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">
        Réinitialiser mon mot de passe
      </a>
      <p style="font-size:13px;color:#888">Ce lien expire dans 1 heure.</p>
      <p style="font-size:13px;color:#888">Si vous n'avez pas fait cette demande, ignorez cet email.</p>
    </div>
  `);
}
