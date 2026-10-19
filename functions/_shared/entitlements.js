// functions/_shared/entitlements.js
// Server-authoritative watermark + free-trial ("3 contoh dokumen tanpa watermark") logic.
// The browser can only READ these decisions; it can never set them.

const DOC_TRIAL_COLUMN = {
  invoice: 'trial_invoice_used',
  kwitansi: 'trial_kwitansi_used',
  'surat-jalan': 'trial_surat_jalan_used'
};

// API/UI contract uses camelCase keys (trial.suratJalan) even though the
// internal doc type slug is 'surat-jalan'.
const TRIAL_KEY = { invoice: 'invoice', kwitansi: 'kwitansi', 'surat-jalan': 'suratJalan' };

export function isPaidActive(user) {
  const plan = user.plan || 'free';
  if (plan !== 'pro' && plan !== 'enterprise') return false;
  if (Number(user.is_active) === 0) return false;
  if (user.subscription_status && user.subscription_status !== 'active') return false;
  if (Number(user.is_lifetime) === 1) return true;
  if (user.subscription_expires_at) {
    const exp = new Date(user.subscription_expires_at);
    if (!Number.isNaN(exp.getTime()) && exp.getTime() < Date.now()) return false;
  }
  return true;
}

export function isSuperadminUser(user, superadminEmail) {
  const email = (user.email || '').toLowerCase().trim();
  return Number(user.is_superadmin) === 1 &&
    (!superadminEmail || email === superadminEmail.toLowerCase().trim());
}

/**
 * Compute the entitlement snapshot returned to the client.
 * @returns {{ plan, role, hasWatermark, isSuperadmin, isPaid,
 *             trial: { invoice, kwitansi, suratJalan }, expiresAt }}
 * `trial[type]` = number of remaining clean (no-watermark) documents of that type.
 */
export function computeEntitlement(user, superadminEmail) {
  const superAdmin = isSuperadminUser(user, superadminEmail);
  const paid = isPaidActive(user);

  // Paid / superadmin never see a watermark and do not consume trial.
  const unlimited = superAdmin || paid;

  const trial = {};
  for (const [type, col] of Object.entries(DOC_TRIAL_COLUMN)) {
    trial[TRIAL_KEY[type]] = unlimited ? null : (Number(user[col]) === 0 ? 1 : 0);
  }

  return {
    plan: superAdmin ? 'enterprise' : (user.plan || 'free'),
    role: superAdmin ? 'superadmin' : 'user',
    isSuperadmin: superAdmin,
    isPaid: paid,
    // Global default "will a brand-new doc be watermarked?" (per-type resolved on save).
    hasWatermark: !unlimited && Object.values(trial).every(v => v === 0),
    trial,
    expiresAt: user.subscription_expires_at || null
  };
}

/**
 * Whether a NEW document of `docType` should carry a watermark for this user,
 * and whether saving it should consume a trial credit.
 */
export function resolveWatermark(user, superadminEmail, docType) {
  const ent = computeEntitlement(user, superadminEmail);
  if (ent.isSuperadmin || ent.isPaid) {
    return { hasWatermark: false, consumesTrial: false };
  }
  const remaining = ent.trial[TRIAL_KEY[docType]] ?? 0;
  if (remaining > 0) {
    return { hasWatermark: false, consumesTrial: true };
  }
  return { hasWatermark: true, consumesTrial: false };
}

/** Increment the per-type trial counter (only meaningful for free users). */
export async function consumeTrial(db, userId, docType) {
  const col = DOC_TRIAL_COLUMN[docType];
  if (!col) return;
  await db.prepare(`UPDATE users SET ${col} = 1 WHERE id = ? AND ${col} = 0`).bind(userId).run();
}
