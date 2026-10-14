// Transactional email through Resend (https://resend.com)
export const passwordResetConfigured = (env) =>
  Boolean(env.RESEND_API_KEY && env.PASSWORD_RESET_FROM && env.PUBLIC_SITE_URL)

// Returns false when Resend rejects the message
export async function sendPasswordReset(env, to, link) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.PASSWORD_RESET_FROM,
      to: [to],
      subject: 'Reset your Kimish admin password',
      text: `Reset your password using this single-use link (expires in 20 minutes): ${link}`,
    }),
  })
  if (!response.ok) console.error('Password reset email delivery failed:', response.status)
  return response.ok
}
