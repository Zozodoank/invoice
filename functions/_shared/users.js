// functions/_shared/users.js
// Data-access helpers for the `users` table (the source of truth for role/plan/trial).

import { newId } from './util.js';
import { computeEntitlement } from './entitlements.js';

/** Find a user row by email (case-insensitive, normalized). */
export async function findUserByEmail(db, email) {
  const norm = (email || '').toLowerCase().trim();
  if (!norm) return null;
  return await db
    .prepare('SELECT * FROM users WHERE lower(email) = ? LIMIT 1')
    .bind(norm)
    .first();
}

export async function findUserById(db, id) {
  if (!id) return null;
  return await db.prepare('SELECT * FROM users WHERE id = ? LIMIT 1').bind(id).first();
}

/**
 * Upsert a user from a verified Google ID-token payload.
 * Never accepts role/plan/superadmin from the client — those come only from DB columns.
 */
export async function upsertUserFromGoogle(db, payload) {
  const email = (payload.email || '').toLowerCase().trim();
  const name = payload.name || email.split('@')[0];
  const avatar = payload.picture || null;

  let user = await findUserByEmail(db, email);
  if (user) {
    if ((user.name !== name || user.avatar_url !== avatar)) {
      await db
        .prepare("UPDATE users SET name = ?, avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(name, avatar, user.id)
        .run();
      user = await findUserById(db, user.id);
    }
    return user;
  }

  const id = newId('usr');
  await db
    .prepare(
      `INSERT INTO users (id, email, name, avatar_url, oauth_provider, oauth_id, plan, subscription_status, is_active)
       VALUES (?, ?, ?, ?, 'google', ?, 'free', 'active', 1)`
    )
    .bind(id, email, name, avatar, payload.sub || null)
    .run();
  return await findUserById(db, id);
}

/** Public, non-privileged view of a user + entitlement for the client UI. */
export function publicUserWithEntitlement(user, superadminEmail) {
  const ent = computeEntitlement(user, superadminEmail);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatar: user.avatar_url,
    company: user.company || null,
    role: ent.role,
    plan: ent.plan,
    isSuperadmin: ent.isSuperadmin,
    hasWatermark: ent.hasWatermark,
    trial: ent.trial,
    expiresAt: ent.expiresAt,
    isActive: Number(user.is_active) !== 0
  };
}
