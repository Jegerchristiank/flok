import { FlokDB, ID, FlokInvite } from '../types';
import { uid, nowIso } from '../utils';

export const isAlreadyInvited = (db: FlokDB, eventId: ID, userId: ID) =>
  (db.invites || []).some((i) => i.eventId === eventId && i.to === userId && i.status !== 'declined');

export const sendInvitesDb = (
  db: FlokDB,
  eventId: ID,
  from: ID,
  toUserIds: ID[],
): { db: FlokDB; created: FlokInvite[] } => {
  const created: FlokInvite[] = [];
  const existingTo = new Set((db.invites || []).filter((i) => i.eventId === eventId).map((i) => i.to));
  const nextInvites: FlokInvite[] = ([...(db.invites || [])] as FlokInvite[]);
  const now = nowIso();
  for (const to of toUserIds) {
    if (existingTo.has(to)) continue;
    const invite: FlokInvite = { id: uid(), eventId, from, to, at: now, status: 'pending' };
    nextInvites.push(invite);
    created.push(invite);
  }
  const next: FlokDB = { ...db, invites: nextInvites };
  return { db: next, created };
};

export const acceptInviteDb = (db: FlokDB, inviteId: ID): FlokDB => {
  const inv = (db.invites || []).find((i) => i.id === inviteId);
  if (!inv) return db;
  const ev = db.events[inv.eventId];
  const nextInvites: FlokInvite[] = (db.invites || []).map((i) =>
    i.id === inviteId ? ({ ...i, status: 'accepted' } as FlokInvite) : i
  );
  if (!ev) return { ...db, invites: nextInvites };
  // Markér som 'maybe' for at give adgang og signalere interesse
  const attendees = { ...(ev.attendees || {}) };
  attendees[inv.to] = { status: 'maybe', by: inv.to, at: nowIso(), withChildren: [] };
  const nextEv = { ...ev, attendees };
  return { ...db, invites: nextInvites, events: { ...db.events, [ev.id]: nextEv } };
};

export const declineInviteDb = (db: FlokDB, inviteId: ID): FlokDB => {
  const nextInvites: FlokInvite[] = (db.invites || []).map((i) =>
    i.id === inviteId ? ({ ...i, status: 'declined' } as FlokInvite) : i
  );
  return { ...db, invites: nextInvites };
};
