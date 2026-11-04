import { db } from '../../db/client.js';
import * as schema from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export type AdminActor = Pick<typeof schema.adminUsers.$inferSelect, 'id' | 'role'>;

export function getAdminActor(cookieHeader: string | undefined): AdminActor | null {
  const sessionId = cookieHeader?.split(';').map((part) => part.trim()).find((part) => part.startsWith('session_id='))?.slice('session_id='.length);
  if (!sessionId) return null;
  const session = db.select().from(schema.sessions).where(eq(schema.sessions.id, sessionId)).get();
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId)).run();
    return null;
  }
  const user = db.select().from(schema.adminUsers).where(eq(schema.adminUsers.id, session.userId)).get();
  return user ? { id: user.id, role: user.role } : null;
}

export function canManageInvitation(actor: AdminActor, invitation: { ownerUserId: string | null }): boolean {
  return actor.role === 'super_admin' || (invitation.ownerUserId !== null && invitation.ownerUserId === actor.id);
}

export function authorizedInvitation(cookieHeader: string | undefined, id: string) {
  const actor = getAdminActor(cookieHeader);
  if (!actor) return { status: 401 as const, invitation: null };
  const invitation = db.select().from(schema.invitations).where(eq(schema.invitations.id, id)).get();
  if (!invitation || !canManageInvitation(actor, invitation)) return { status: 404 as const, invitation: null };
  return { status: 200 as const, invitation };
}
