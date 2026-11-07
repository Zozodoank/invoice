// functions/api/export/action.js  ->  POST /api/export/action
// Validasi dan konsumsi 1 kredit cetak/unduh PDF per aksi (Kredit Per Aksi).
// Server-authoritative: browser tidak bisa mengurangi atau memalsukan kredit.

import { requireAuth } from '../../_shared/guards.js';
import { isSuperadminUser } from '../../_shared/entitlements.js';
import { json } from '../../_shared/util.js';

export async function onRequestPost(context) {
  const auth = await requireAuth(context);
  if (auth instanceof Response) return auth;

  let body;
  try { body = await context.request.json(); } catch { body = {}; }

  const action = String(body.action || 'print').toLowerCase();
  const type = String(body.type || 'invoice').toLowerCase();

  // Superadmin tidak mengonsumsi kredit (unlimited)
  if (isSuperadminUser(auth.user, context.data.superadminEmail)) {
    return json({
      ok: true,
      action,
      type,
      remainingCredits: 999999,
      isSuperadmin: true
    }, 200, { 'Cache-Control': 'no-store' });
  }

  // Atomically decrement 1 credit jika print_credits > 0
  const result = await context.env.DB
    .prepare("UPDATE users SET print_credits = print_credits - 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND print_credits > 0")
    .bind(auth.user.id)
    .run();

  if (!result || !result.meta || result.meta.changes === 0) {
    // Kredit 0 atau habis
    const cur = await context.env.DB
      .prepare("SELECT print_credits FROM users WHERE id = ?")
      .bind(auth.user.id)
      .first();
    const remaining = cur && cur.print_credits != null ? Number(cur.print_credits) : 0;
    return json({
      ok: false,
      error: 'insufficient_credits',
      remainingCredits: remaining,
      message: 'Kredit cetak/unduh Anda habis. Silakan bayar Rp 1.000 via QRIS dinamis.'
    }, 402, { 'Cache-Control': 'no-store' });
  }

  const updated = await context.env.DB
    .prepare("SELECT print_credits FROM users WHERE id = ?")
    .bind(auth.user.id)
    .first();
  const remaining = updated && updated.print_credits != null ? Number(updated.print_credits) : 0;

  return json({
    ok: true,
    action,
    type,
    remainingCredits: remaining
  }, 200, { 'Cache-Control': 'no-store' });
}
