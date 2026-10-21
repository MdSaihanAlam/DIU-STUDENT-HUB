import { env } from '../config/env.js';

let transporterPromise = null;

async function getTransporter() {
  if (!env.smtp.host) return null;
  if (!transporterPromise) {
    transporterPromise = import('nodemailer').then(({ default: nodemailer }) =>
      nodemailer.createTransport({
        host: env.smtp.host,
        port: env.smtp.port,
        secure: env.smtp.port === 465,
        auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
      })
    );
  }
  return transporterPromise;
}

export const mailConfigured = () => Boolean(env.smtp.host);

/**
 * Send a transactional email. Without SMTP configured, the message is printed to the
 * console in development (so reset/verify links can be tested) and skipped in production.
 */
export async function sendMail({ to, subject, text }) {
  const transporter = await getTransporter();
  if (!transporter) {
    if (!env.isProd && !env.isTest) {
      console.log(`\n[mail:dev] To: ${to}\n[mail:dev] Subject: ${subject}\n${text}\n`);
    } else if (env.isProd) {
      console.warn('[mail] SMTP is not configured; email was not sent.');
    }
    return false;
  }
  await transporter.sendMail({ from: env.smtp.from, to, subject, text });
  return true;
}
