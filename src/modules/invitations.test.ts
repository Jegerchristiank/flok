import { describe, it, expect } from 'vitest';
import { sendInvitesDb, acceptInviteDb, declineInviteDb, isAlreadyInvited } from './invitations';
import type { FlokDB } from '../types';
import { uid, nowIso } from '../utils';

const makeDb = () => {
  const host = uid();
  const a = uid();
  const b = uid();
  const eventId = uid();
  const db: FlokDB = {
    users: {
      [host]: { id: host, name: 'Host', email: 'h@example.com', phone: '+4500000001', isParent: false, children: [], friends: [], friendRequestsIncoming: [], friendRequestsOutgoing: [], socials: {}, createdAt: nowIso() },
      [a]: { id: a, name: 'A', email: 'a@example.com', phone: '+4500000002', isParent: false, children: [], friends: [], friendRequestsIncoming: [], friendRequestsOutgoing: [], socials: {}, createdAt: nowIso() },
      [b]: { id: b, name: 'B', email: 'b@example.com', phone: '+4500000003', isParent: false, children: [], friends: [], friendRequestsIncoming: [], friendRequestsOutgoing: [], socials: {}, createdAt: nowIso() },
    },
    friendships: [],
    events: {
      [eventId]: {
        id: eventId,
        title: 'T',
        description: '',
        address: '',
        datetime: new Date(Date.now() + 864e5).toISOString(),
        timezone: 'UTC',
        isPublic: true,
        hasPassword: false,
        hostId: host,
        allowGuestPosts: true,
        notifyOnHostPost: true,
        waitlist: false,
        rsvpPolicy: { type: 'none' },
        attendees: {},
        waitlistQueue: [],
        posts: [],
        chat: [],
        tempAccounts: {},
        inviteToken: uid(),
        createdAt: nowIso(),
        archivedAt: null,
      },
    } as any,
    sessions: {},
    notifications: [],
    invites: [],
  };
  return { db, ids: { host, a, b, eventId } };
};

describe('invitations module', () => {
  it('sends invites without duplicates', () => {
    const { db, ids } = makeDb();
    const res1 = sendInvitesDb(db, ids.eventId, ids.host, [ids.a, ids.b]);
    expect(res1.created.length).toBe(2);
    const res2 = sendInvitesDb(res1.db, ids.eventId, ids.host, [ids.a]);
    expect(res2.created.length).toBe(0);
    expect(isAlreadyInvited(res2.db, ids.eventId, ids.a)).toBe(true);
  });

  it('accepts an invite and adds maybe RSVP', () => {
    const { db, ids } = makeDb();
    const res = sendInvitesDb(db, ids.eventId, ids.host, [ids.a]);
    const inviteId = res.created[0].id;
    const next = acceptInviteDb(res.db, inviteId);
    const inv = next.invites.find((i) => i.id === inviteId)!;
    expect(inv.status).toBe('accepted');
    const ev = next.events[ids.eventId];
    expect(ev.attendees[ids.a]).toBeTruthy();
    expect(ev.attendees[ids.a].status).toBe('maybe');
  });

  it('declines an invite', () => {
    const { db, ids } = makeDb();
    const res = sendInvitesDb(db, ids.eventId, ids.host, [ids.a]);
    const inviteId = res.created[0].id;
    const next = declineInviteDb(res.db, inviteId);
    const inv = next.invites.find((i) => i.id === inviteId)!;
    expect(inv.status).toBe('declined');
  });
});

