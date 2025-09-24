import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar as CalendarIcon,
  Users,
  UserPlus,
  UserCheck,
  MapPin,
  Clock,
  Plus,
  X,
  Check,
  Copy,
  Share2,
  LogIn,
  LogOut,
  Lock,
  Unlock,
  ShieldAlert,
  Bell,
  BellRing,
  MessageSquare,
  Image as ImageIcon,
  SunMedium,
  Moon,
  Settings,
  Globe2,
  Search,
  Filter,
  Pin as PinIcon,
  PinOff,
  Download,
  FileText,
  ArrowLeft,
  AtSign,
  Phone,
  Hourglass,
  Heart,
  RefreshCw,
} from "lucide-react";
 
// ------------------------------------------------------------
// F L O K  —  begivenheder for alle
// Single file React app til Canvas. Minimalistisk Apple look, dansk sprog.
// Funktioner i denne første version:
//  • Opret begivenheder med titel, billede, beskrivelse, adresse, dato og tid
//  • Offentlig eller privat med valgfrit begivenhedskodeord
//  • Invitation via link og hurtig deling
//  • Konto eller midlertidigt login pr. begivenhed (brugernavn + PIN 4–6 cifre)
//  • RSVP: Deltager, Deltager ikke, Måske — med værtskontrol af regler og deadlines
//  • Venner: Venneanmodninger, søgning og hurtiginvitering
//  • Forældre kan tilføje børn som deltagere under deres egen RSVP
//  • Værtsopslag med mulighed for gæsteopslag, billedupload med komprimering
//  • Notifikationer i browser når værten poster nyt
//  • Max deltagere, venteliste og promotion fra venteliste
//  • Kalender: ICS eksport samt Google Kalender link
//  • Kortlinks: Apple Maps, Google Maps og kopi af adresse
//  • Lys tilstand og mørk tilstand
//  • Lokal persistence i browserens localStorage
//  • Dansk tidszone og visning i brugerens lokale tidszone
// ------------------------------------------------------------
 
// Tailwind UI helpers
import { card, btn, btnPrimary, chip } from "./src/ui/styles";
import { toast, toastAction } from './src/ui/toast';
import { haptic } from './src/ui/feedback';
import FocusTrap from './src/ui/FocusTrap';
import SuccessPing from './src/ui/success-ping';
import InviteDialog from './src/components/InviteDialog';
import TempLoginDialog from './src/components/TempLoginDialog';
import { confirm as askConfirm } from './src/ui/confirm';
import { isAlreadyInvited, sendInvitesDb, acceptInviteDb, declineInviteDb } from './src/modules/invitations';
import type { FlokDB, FlokEvent, FlokInvite, FlokUser, NotificationItem, Post, RSVP } from './src/types';
import { uid, nowIso, fmtDateTime, fmtDateTimeRange, toGoogleCalLink, toICS, buildInviteUrl, escapeICS } from './src/utils';

// Kort, læsevenlig invitationskode (unik pr. event)
const INVITE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // uden 0,O,1,I,L
function generateInviteToken(db: any, len = 6): string {
  const events = Object.values((db && db.events) || {});
  const isFree = (code: string) => !events.some((e: any) => (e?.inviteToken || '') === code);
  for (let tries = 0; tries < 100; tries++) {
    let code = '';
    for (let i = 0; i < len; i++) code += INVITE_ALPHABET[Math.floor(Math.random() * INVITE_ALPHABET.length)];
    if (isFree(code)) return code;
    if (tries === 50) len++; // sjælden fallback hvis meget lille plads
  }
  // Som sidste udvej: fallback til uid forkortet
  return (uid().toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/[O0IL1]/g, '').slice(0, len) || 'FL0K99');
}

// Farverige små prikker i Google ånd
const Dot = ({ color = "#4F46E5" }) => (
  <span
    style={{ background: color }}
    className="inline-block w-2.5 h-2.5 rounded-full align-middle"
 />
);


type EventFormState = {
  title: string;
  description: string;
  address: string;
  datetime: string;
  endtime: string;
  timezone: string;
  isPublic: boolean;
  password: string;
  allowGuestPosts: boolean;
  notifyOnHostPost: boolean;
  maxGuests: string;
  waitlist: boolean;
  autoPromote: boolean;
  rsvpPolicy: 'none' | 'deadline' | 'max' | 'both';
  deadline: string;
  cover: string;
  repeat: 'none' | 'weekly' | 'monthly';
  repeatCount: string;
};

 
const copy = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};
 
const notify = async (title, body) => {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") new Notification(title, { body });
};
 
const compressImage = (file, maxWidth = 1600, quality = 0.82) =>
  new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => {
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => {
            resolve({ blob, dataUrl: canvas.toDataURL("image/jpeg", quality) });
          },
          "image/jpeg",
          quality
        );
      };
      img.src = typeof e.target?.result === 'string' ? e.target.result : '';
    };
    reader.readAsDataURL(file);
  });
 
// Lokal persistent lagring
const DB_KEY = "flok-db-v1";

function createEmptyDB(): FlokDB {
  return {
    users: {},
    friendships: [],
    events: {},
    sessions: {},
    notifications: [],
    invites: [],
  };
}

function readDB(): FlokDB {
  const raw = localStorage.getItem(DB_KEY);
  if (!raw) {
    const db = createEmptyDB();
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    return db;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<FlokDB>;
    const base = createEmptyDB();
    const db: FlokDB = {
      ...base,
      ...parsed,
      users: { ...base.users, ...(parsed.users ?? {}) },
      friendships: parsed.friendships ? [...parsed.friendships] : [],
      events: { ...base.events, ...(parsed.events ?? {}) },
      sessions: { ...base.sessions, ...(parsed.sessions ?? {}) },
      notifications: parsed.notifications ? [...parsed.notifications] : [],
      invites: parsed.invites ? [...parsed.invites] : [],
    };
    // Data retention: slet events færdige for over 90 dage siden
    const ninety = 90 * 864e5;
    const now = Date.now();
    for (const ev of Object.values(db.events)) {
      try {
        const t = new Date(ev.datetime).getTime();
        if (now - t > ninety && !ev.archivedAt) ev.archivedAt = new Date(t + ninety).toISOString();
      } catch {}
    }
    // Notifikationer: sørg for read/type/owner/importance
    const mapImportance = (t: NotificationItem['type']) => (t === 'rsvp' || t === 'friend' ? 'high' : 'low');
    db.notifications = db.notifications.map((n) => ({
      id: n.id || uid(),
      text: n.text || '',
      at: n.at || nowIso(),
      read: typeof n.read === 'boolean' ? n.read : false,
      type: n.type || 'info',
      owner: n.owner || undefined,
      importance: (n.importance === 'high' || n.importance === 'low') ? n.importance : mapImportance(n.type || 'info'),
    }));
    // Brugere: bagudkompatible felter
    try {
      for (const uidKey of Object.keys(db.users)) {
        const u = db.users[uidKey];
        u.friends = Array.isArray(u.friends) ? u.friends : [];
        // Fjern legacy 'follows'
        if ((u as any).follows) delete (u as any).follows;
        // Venneanmodninger
        u.friendRequestsIncoming = Array.isArray(u.friendRequestsIncoming) ? u.friendRequestsIncoming : [];
        u.friendRequestsOutgoing = Array.isArray(u.friendRequestsOutgoing) ? u.friendRequestsOutgoing : [];
        // Sociale links
        u.socials = u.socials && typeof u.socials === 'object' ? u.socials : {};
      }
    } catch {}
    // Invitationer: bagudkompatibel initialisering
    db.invites = db.invites.map((iv) => ({
      id: iv.id || uid(),
      eventId: iv.eventId,
      from: iv.from,
      to: iv.to,
      at: iv.at || nowIso(),
      status: (iv.status === 'pending' || iv.status === 'accepted' || iv.status === 'declined') ? iv.status : 'pending',
    }));
    return db;
  } catch {
    const db = createEmptyDB();
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    return db;
  }
}

function writeDB(db: FlokDB) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}
 
// Web Share helper
const webShare = async (opts: { title?: string; text?: string; url?: string }) => {
  try {
    if ((navigator as any).share) {
      await (navigator as any).share(opts);
      return true;
    }
  } catch {}
  return false;
};

// App
export default function FlokApp() {
  const [db, setDb] = useState<FlokDB>(() => readDB());
  const [sessionId, setSessionId] = useState<string>(() => {
    const first = Object.keys(db.sessions)[0] || uid();
    if (!db.sessions[first]) db.sessions[first] = {};
    writeDB(db);
    return first;
  });
  const session: FlokDB['sessions'][string] = db.sessions[sessionId] ?? {};
  const me = session.userId ? db.users[session.userId] ?? null : null;
  const [route, setRoute] = useState<{ name: string; id?: string }>(() => {
    // Deep link via hash `#event:<id>` / `#profile:<id>` eller search `?event=<id>`
    const hash = typeof location !== "undefined" ? location.hash : "";
    const mEvent = /#event:([^;]+)/.exec(hash || "");
    if (mEvent?.[1]) return { name: "event", id: mEvent[1] };
    const mProfile = /#profile:([^;]+)/.exec(hash || "");
    if (mProfile?.[1]) return { name: "profile", id: mProfile[1] };
    const params = typeof location !== "undefined" ? new URLSearchParams(location.search) : null;
    const qId = params?.get("event");
    if (qId) return { name: "event", id: qId };
    return { name: "home" };
  });
  const [theme, setTheme] = useState(() => localStorage.getItem("flok-theme") || "light");
  const [textScale, setTextScale] = useState<string>(() => localStorage.getItem('flok-text-scale') || '1');
 
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("flok-theme", theme);
  }, [theme]);

  useEffect(() => {
    try {
      document.documentElement.style.setProperty('--text-scale', textScale);
      localStorage.setItem('flok-text-scale', textScale);
    } catch {}
  }, [textScale]);

  // Sync route to hash for simple deep-linking
  useEffect(() => {
    if (route.name === "event" && route.id) {
      if (location.hash !== `#event:${route.id}`) location.hash = `#event:${route.id}`;
    } else if (route.name === 'profile' && route.id) {
      if (location.hash !== `#profile:${route.id}`) location.hash = `#profile:${route.id}`;
    } else if (location.hash) {
      history.replaceState(null, "", location.pathname + location.search);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.name, (route as any).id]);

  // Notifikationstilladelse + feedback
  const askNotify = async () => {
    if (!("Notification" in window)) {
      toast("Din browser understøtter ikke notifikationer", 'error');
      return;
    }
    if (Notification.permission === "granted") {
      try { new Notification("Flok", { body: "Notifikationer er aktiveret" }); } catch {}
      toast("Notifikationer er allerede aktiveret", 'info');
      return;
    }
    const res = await Notification.requestPermission();
    if (res === "granted") {
      try { new Notification("Flok", { body: "Tak – notifikationer er slået til" }); } catch {}
      toast("Notifikationer er slået til", 'success');
    } else if (res === "denied") {
      toast("Du har blokeret notifikationer i din browser", 'error');
    }
  };
 
  // Routing helpers
  const goEvent = (id) => setRoute({ name: "event", id });

  // Permissions and actor helpers
  const actorIdForEvent = (eventId) => {
    if (me?.id) return me.id;
    const t = db.sessions[sessionId]?.temp;
    if (t && t.eventId === eventId) {
      const ev = db.events[eventId];
      const rec = ev?.tempAccounts?.[t.username];
      return rec?.userId;
    }
    return undefined;
  };
  // Fallback visningsnavn i en event-kontekst (brug tempAccounts username hvis ingen bruger findes)
  const nameInEvent = (eventOrId, userId) => {
    const ev = typeof eventOrId === 'string' ? db.events[eventOrId] : eventOrId;
    const n = db.users[userId]?.name;
    if (n) return n;
    try {
      for (const [uname, rec] of Object.entries((ev?.tempAccounts) || {})) {
        if ((rec as any)?.userId === userId) return uname as string;
      }
    } catch {}
    return 'Gæst';
  };
  const visibleToUser = (ev) => {
    if (ev.isPublic) return true;
    // Host always sees own private events
    if (me?.id && ev.hostId === me.id) return true;
    // Logged-in user is invited if already in attendees
    if (me?.id && ev.attendees && ev.attendees[me.id]) return true;
    // Or if der findes en intern invitation
    if (me?.id && (db.invites || []).some((iv)=> iv.eventId === ev.id && iv.to === me.id && (iv.status === 'pending' || iv.status === 'accepted'))) return true;
    // Temporary login for this event counts as invited
    const t = db.sessions[sessionId]?.temp;
    if (t && t.eventId === ev.id) return true;
    // Or if the temp user has already RSVP'et
    if (t && t.eventId === ev.id) {
      const rec = ev.tempAccounts?.[t.username];
      if (rec?.userId && ev.attendees?.[rec.userId]) return true;
    }
    return false;
  };

  // Gem DB (understøtter både objekt og updater-funktion)
  const save = (nextOrFn: FlokDB | ((prev: FlokDB) => FlokDB)) => {
    if (typeof nextOrFn === 'function') {
      setDb((prev) => {
        const next = (nextOrFn as (prev: FlokDB) => FlokDB)(prev);
        writeDB(next);
        return next;
      });
    } else {
      setDb(nextOrFn);
      writeDB(nextOrFn);
    }
  };

  // Aktuel aktør (konto eller temp)
  const currentActorId = () => {
    if (me?.id) return me.id;
    const t = db.sessions[sessionId]?.temp;
    if (t) {
      const rec = db.events[t.eventId]?.tempAccounts?.[t.username];
      return rec?.userId;
    }
    return undefined;
  };
  // Notifikationshjælper med ejerskab og vigtighed
  const pushNotif = (text, type = "info", importance = 'low') => {
    const n = { id: uid(), text, at: nowIso(), read: false, type, owner: currentActorId(), importance } as any;
    save((prev) => ({ ...prev, notifications: [...(prev.notifications || []), n] }));
    // Kun systemnotifikation (browser) for vigtige
    if (importance === 'high') {
      try { notify('Flok', text); } catch {}
    }
  };

  const pushNotifTo = (userId: string, text: string, type = 'info', importance: 'high' | 'low' = 'high') => {
    const n = { id: uid(), text, at: nowIso(), read: false, type, owner: userId, importance } as any;
    save((prev) => ({ ...prev, notifications: [...(prev.notifications || []), n] }));
    if (importance === 'high') {
      try { notify('Flok', text); } catch {}
    }
  };
 
  // Opret event
  const createEvent = (payload) => {
    if (!me?.id) {
      toast('Log ind for at oprette begivenheder', 'error');
      haptic('medium');
      return { id: '' };
    }
    const ownerId = me.id;
                const id = uid();
                const ev = {
                        id,
                        title: payload.title.trim() || "Ny begivenhed",
                        cover: payload.cover || "",
                        description: payload.description || "",
                        address: payload.address || "",
                        datetime: payload.datetime || new Date(Date.now() + 864e5).toISOString(),
                        endtime: payload.endtime || new Date(new Date(payload.datetime || Date.now() + 864e5).getTime() + 2 * 60 * 60 * 1000).toISOString(),
                        timezone: payload.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Copenhagen",
                        isPublic: payload.isPublic ?? true,
                        hasPassword: !!payload.password,
                        password: payload.password || "",
      hostId: ownerId,
      cohosts: payload.cohosts || [],
      allowGuestPosts: payload.allowGuestPosts ?? true,
      notifyOnHostPost: payload.notifyOnHostPost ?? true,
      maxGuests: payload.maxGuests || undefined,
      waitlist: payload.waitlist ?? true,
      autoPromote: payload.autoPromote ?? false,
      rsvpPolicy: payload.rsvpPolicy || { type: "none" },
      attendees: {},
      waitlistQueue: [],
      posts: [],
      chat: [],
      tempAccounts: {},
      inviteToken: generateInviteToken(db),
      seriesId: payload.seriesId || undefined,
      seriesIndex: payload.seriesIndex || undefined,
      seriesTotal: payload.seriesTotal || undefined,
      createdAt: nowIso(),
      archivedAt: null,
    };
    const next = { ...db, events: { ...db.events, [id]: ev } };
    save(next);
    return { id };
  };
 
  // Log ind og ud
  const login = (email, password, phone) => {
    // Fake: match på email eller phone
    const user = Object.values(db.users).find(
      (u) => u.email === email || (phone && u.phone === phone)
    );
    if (user) {
      const next = { ...db, sessions: { ...db.sessions, [sessionId]: { userId: user.id } } };
      save(next);
      return { ok: true, user };
    }
    return { ok: false, error: "Bruger ikke fundet" };
  };
  const register = (name, email, phone) => {
    const exists = Object.values(db.users).some((u) => u.email === email || u.phone === phone);
    if (exists) return { ok: false, error: "E mail eller telefon er allerede i brug" };
    const id = uid();
    const user = {
      id,
      name,
      email,
      phone,
      isParent: false,
      children: [],
      friends: [],
      friendRequestsIncoming: [],
      friendRequestsOutgoing: [],
      socials: {},
      createdAt: nowIso(),
    };
    const next = { ...db, users: { ...db.users, [id]: user }, sessions: { ...db.sessions, [sessionId]: { userId: id } } };
    save(next);
    return { ok: true, user };
  };
  const convertToPermanentAccount = (userId, name, email, phone) => {
    const u = db.users[userId];
    if (!u) return { ok: false, error: 'Bruger ikke fundet' };
    const nm = (name||'').trim();
    const em = (email||'').trim();
    const ph = (phone||'').trim();
    if (!nm || !em || !ph) return { ok: false, error: 'Udfyld navn, e-mail og telefon' };
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return { ok: false, error: 'Ugyldig e-mail' };
    if (!/^\+?\d[\d\s-]{5,}$/.test(ph)) return { ok: false, error: 'Ugyldigt telefonnummer' };
    const clash = Object.values(db.users).some((x) => x.id !== userId && (x.email === em || x.phone === ph));
    if (clash) return { ok: false, error: 'E-mail eller telefon er allerede i brug' };
    const updated = { ...u, name: nm, email: em, phone: ph };
    const next = { ...db, users: { ...db.users, [userId]: updated }, sessions: { ...db.sessions, [sessionId]: { ...(db.sessions[sessionId]||{}), userId } } };
    save(next);
    return { ok: true };
  };
  const logout = () => {
    // Bevar midlertidigt event-login, men fjern konto-login
    const cur = db.sessions[sessionId] || {};
    const next = { ...db, sessions: { ...db.sessions, [sessionId]: { temp: cur.temp } } };
    save(next);
  };
 
  // Midlertidigt login pr event
  const createTempLogin = (eventId, username, pin) => {
    const ev = db.events[eventId];
    if (!ev) return { ok: false, error: "Begivenhed ikke fundet" };
    if (!/^\d{4,6}$/.test(pin)) return { ok: false, error: "PIN skal være 4 til 6 cifre" };
    const exists = ev.tempAccounts[username];
    if (exists) return { ok: false, error: "Brugernavn er optaget i denne begivenhed" };
    const tempUserId = uid();
    const expires = new Date(new Date(ev.datetime).getTime() + 30 * 864e5).toISOString();
    // Opret en minimal brugerprofil så navnet kan vises i gæsteliste m.m.
    const tempUser = {
      id: tempUserId,
      name: username || 'Gæst',
      email: '',
      phone: '',
      isParent: false,
      children: [],
      friends: [],
      friendRequestsIncoming: [],
      friendRequestsOutgoing: [],
      socials: {},
      createdAt: nowIso(),
    };
    ev.tempAccounts[username] = { pin, createdAt: nowIso(), expiresAt: expires, userId: tempUserId };
    const next = { ...db, users: { ...db.users, [tempUserId]: tempUser }, events: { ...db.events, [eventId]: { ...ev } }, sessions: { ...db.sessions, [sessionId]: { temp: { eventId, username } } } };
    save(next);
    return { ok: true };
  };
  const authTemp = (eventId, username, pin) => {
    const ev = db.events[eventId];
    const rec = ev?.tempAccounts?.[username];
    if (!rec) return { ok: false, error: "Ukendt brugernavn" };
    if (rec.pin !== pin) return { ok: false, error: "Forkert PIN" };
    if (new Date(rec.expiresAt).getTime() < Date.now()) return { ok: false, error: "Login er udløbet" };
    const next = { ...db, sessions: { ...db.sessions, [sessionId]: { temp: { eventId, username } } } };
    save(next);
    return { ok: true };
  };
 
  // Venner
  const friendStatus = (aId, bId) => {
    const a = db.users[aId];
    const b = db.users[bId];
    if (!a || !b) return 'none';
    if ((a.friends || []).includes(bId)) return 'friends';
    if ((a.friendRequestsOutgoing || []).includes(bId)) return 'outgoing';
    if ((a.friendRequestsIncoming || []).includes(bId)) return 'incoming';
    return 'none';
  };
  const sendFriendRequest = (targetId) => {
    if (!me) return;
    if (me.id === targetId) return;
    const target = db.users[targetId];
    if (!target) return;
    const status = friendStatus(me.id, targetId);
    if (status === 'friends' || status === 'outgoing') return;
    if (status === 'incoming') { // auto-accept if de allerede har sendt
      acceptFriendRequest(targetId);
      return;
    }
    const me2 = { ...me, friendRequestsOutgoing: [...(me.friendRequestsOutgoing||[]), targetId] };
    const target2 = { ...target, friendRequestsIncoming: [...(target.friendRequestsIncoming||[]), me.id] };
    const next = { ...db, users: { ...db.users, [me.id]: me2, [targetId]: target2 } };
    save(next);
    pushNotif(`Venneanmodning sendt til ${target.name}`);
  };
  const acceptFriendRequest = (fromId) => {
    if (!me) return;
    const from = db.users[fromId];
    if (!from) return;
    const me2 = {
      ...me,
      friends: [...(me.friends||[]), fromId],
      friendRequestsIncoming: (me.friendRequestsIncoming||[]).filter((id) => id !== fromId),
    };
    const from2 = {
      ...from,
      friends: [...(from.friends||[]), me.id],
      friendRequestsOutgoing: (from.friendRequestsOutgoing||[]).filter((id) => id !== me.id),
    };
    const f = { id: uid(), a: me.id, b: fromId, createdAt: nowIso() };
    const next = { ...db, friendships: [...db.friendships, f], users: { ...db.users, [me.id]: me2, [fromId]: from2 } };
    save(next);
    pushNotif(`Du og ${from.name} er nu venner`, 'friend', 'high');
  };
  const declineFriendRequest = (fromId) => {
    if (!me) return;
    const from = db.users[fromId];
    if (!from) return;
    const me2 = { ...me, friendRequestsIncoming: (me.friendRequestsIncoming||[]).filter((id) => id !== fromId) };
    const from2 = { ...from, friendRequestsOutgoing: (from.friendRequestsOutgoing||[]).filter((id) => id !== me.id) };
    const next = { ...db, users: { ...db.users, [me.id]: me2, [fromId]: from2 } };
    save(next);
  };
  const cancelFriendRequest = (targetId) => {
    if (!me) return;
    const target = db.users[targetId];
    if (!target) return;
    const me2 = { ...me, friendRequestsOutgoing: (me.friendRequestsOutgoing||[]).filter((id) => id !== targetId) };
    const target2 = { ...target, friendRequestsIncoming: (target.friendRequestsIncoming||[]).filter((id) => id !== me.id) };
    const next = { ...db, users: { ...db.users, [me.id]: me2, [targetId]: target2 } };
    save(next);
  };
  const unfriend = (targetId) => {
    if (!me) return;
    const target = db.users[targetId];
    if (!target) return;
    if (!((me.friends||[]).includes(targetId))) return;
    const me2 = { ...me, friends: (me.friends||[]).filter((id) => id !== targetId) };
    const t2 = { ...target, friends: (target.friends||[]).filter((id) => id !== me.id) };
    const friendships = (db.friendships || []).filter((f) => !((f.a === me.id && f.b === targetId) || (f.a === targetId && f.b === me.id)));
    const next = { ...db, friendships, users: { ...db.users, [me.id]: me2, [targetId]: t2 } };
    save(next);
  };
  const befriend = (targetId) => {
    // Ny adfærd: send venneanmodning, eller accepter hvis der ligger en indkommende
    const st = me ? friendStatus(me.id, targetId) : 'none';
    if (st === 'friends') return;
    if (st === 'incoming') return acceptFriendRequest(targetId);
    return sendFriendRequest(targetId);
  };
  // (Fjernede 'follow' funktion – ikke længere anvendt)
 
  // RSVP logik inkl. forældre børn
  const rsvp = (eventId, status, withChildren = []) => {
    const ev = db.events[eventId];
    if (!ev) return { ok: false, error: "Begivenhed ikke fundet" };
 
    // Hvem er afsender
    let actorId = me?.id;
    if (!actorId) {
      const t = db.sessions[sessionId]?.temp;
      if (t && t.eventId === eventId) {
        const rec = ev.tempAccounts[t.username];
        actorId = rec?.userId; // temp brugerID lokalt i event
      }
    }
    if (!actorId) return { ok: false, error: "Log ind eller brug midlertidigt login" };
 
    // Regler for svar
    const yesCount = Object.values(ev.attendees).filter((a) => a.status === "yes").length;
    const max = ev.maxGuests || Infinity;
    const policy = ev.rsvpPolicy?.type || "none";
    const nowT = Date.now();
    const deadlineOk =
      policy === "none" || policy === "max" || !ev.rsvpPolicy?.deadline || nowT <= new Date(ev.rsvpPolicy.deadline).getTime();
    const maxOk = policy === "none" || policy === "deadline" || yesCount < max || status !== "yes" || ev.waitlist;
 
    if (!(deadlineOk && maxOk)) {
      toast('Svar er lukket i henhold til værtsindstillinger', 'error');
      haptic('medium');
      return { ok: false, error: "Svar er lukket i henhold til værtsindstillinger" };
    }
 
    // Venteliste hvis nødvendigt
    let finalStatus = status;
    if (status === "yes" && yesCount >= max && ev.waitlist) {
      finalStatus = "maybe"; // marker som måske og tilføj i kø
      if (!ev.waitlistQueue.includes(actorId)) ev.waitlistQueue.push(actorId);
    } else {
      // fjern fra venteliste hvis ikke relevant
      ev.waitlistQueue = ev.waitlistQueue.filter((id) => id !== actorId);
    }
 
    const prev = ev.attendees[actorId];
    const prevWasYes = prev?.status === 'yes';
    ev.attendees[actorId] = { status: finalStatus, by: actorId, at: nowIso(), withChildren };
    // Auto-promover fra venteliste hvis plads er fri og slået til
    const doAutoPromote = () => {
      if (!ev.autoPromote) return;
      const max2 = ev.maxGuests || Infinity;
      let yes2 = Object.values(ev.attendees).filter((a) => a.status === 'yes').length;
      while (ev.waitlist && yes2 < max2 && ev.waitlistQueue.length > 0) {
        const nextUp = ev.waitlistQueue.shift();
        if (!nextUp) break;
        ev.attendees[nextUp] = { ...(ev.attendees[nextUp] || { by: nextUp, at: nowIso(), withChildren: [] }), status: 'yes' };
        yes2++;
      }
    };
    // Trigger når man går fra yes til noget andet, eller generelt efter ændring
    if (prevWasYes && finalStatus !== 'yes') doAutoPromote();
    else doAutoPromote();
    save({ ...db, events: { ...db.events, [eventId]: { ...ev } } });
    const actorName = nameInEvent(ev, actorId);
    pushNotif(`${actorName} svarede ${finalStatus === 'yes' ? 'Deltager' : finalStatus === 'no' ? 'Deltager ikke' : 'Måske'}`, 'rsvp', 'high');
    haptic('light');
    toast('Svar registreret', 'success');
    return { ok: true, status: finalStatus };
  };
 
  const promoteFromWaitlist = (eventId, userId) => {
    const ev = db.events[eventId];
    if (!ev) return;
    const yesCount = Object.values(ev.attendees).filter((a) => a.status === "yes").length;
    const max = ev.maxGuests || Infinity;
    if (yesCount >= max) return;
    const a = ev.attendees[userId];
    if (!a) return;
    a.status = "yes";
    ev.waitlistQueue = ev.waitlistQueue.filter((id) => id !== userId);
    const next = { ...db, events: { ...db.events, [eventId]: { ...ev } } };
    save(next);
  };
 
  // Opslag
  const addPost = async (
    eventId: string,
    text: string,
    files: File[] = [],
    type: Post['type'] = 'guest'
  ) => {
    const ev = db.events[eventId];
    if (!ev) return { ok: false };
    const images: string[] = [];
    for (const f of files) {
      if (f.size > 5 * 1024 * 1024) {
        const res = await compressImage(f);
        images.push((res as { dataUrl?: string } | undefined)?.dataUrl || "");
      } else {
        const reader = new FileReader();
        const dataUrl = await new Promise<string>((resolve) => {
          reader.onload = () =>
            resolve(typeof reader.result === 'string' ? reader.result : '');
          reader.readAsDataURL(f);
        });
        images.push(dataUrl);
      }
    }
    const by = actorIdForEvent(eventId) || "ukendt";
    const post: Post = {
      id: uid(),
      by,
      type,
      text,
      images,
      pinned: false,
      at: nowIso(),
      likes: [],
      comments: [],
    };
    ev.posts.unshift(post);
    const next = { ...db, events: { ...db.events, [eventId]: { ...ev } } };
    save(next);
    // Registrér en lavprioritetsnotifikation lokalt (ingen systemnotifikation)
    if (type === 'host' && ev.notifyOnHostPost) pushNotif('Værtsopslag delt', 'post', 'low');
    return { ok: true };
  };
  const pinPost = (eventId, postId, pinned) => {
    const ev = db.events[eventId];
    if (!ev) return;
    ev.posts = ev.posts.map((p) => (p.id === postId ? { ...p, pinned } : p));
    const next = { ...db, events: { ...db.events, [eventId]: { ...ev } } };
    save(next);
  };
  const deletePost = (eventId, postId) => {
    const ev = db.events[eventId];
    if (!ev) return;
    ev.posts = ev.posts.filter((p) => p.id !== postId);
    const next = { ...db, events: { ...db.events, [eventId]: { ...ev } } };
    save(next);
  };

  const addPoll = (eventId: string, question: string, options: string[], multi = false) => {
    const ev = db.events[eventId];
    if (!ev) return { ok: false };
    const by = actorIdForEvent(eventId) || 'ukendt';
    const poll = {
      question: question || 'Afstemning',
      options: (options || []).map((t) => ({ id: uid(), text: t, votes: [] })),
      multi: !!multi,
    };
    const post: Post = {
      id: uid(),
      by,
      type: 'poll',
      text: '',
      images: [],
      pinned: false,
      at: nowIso(),
      likes: [],
      comments: [],
      poll,
    };
    ev.posts.unshift(post);
    const next = { ...db, events: { ...db.events, [eventId]: { ...ev } } };
    save(next);
    pushNotif('Ny afstemning oprettet', 'post');
    return { ok: true };
  };

  const votePoll = (eventId, postId, optionId) => {
    const ev = db.events[eventId];
    if (!ev) return { ok: false };
    const actor = actorIdForEvent(eventId);
    if (!actor) return { ok: false };
    const post = ev.posts.find((p)=> p.id === postId);
    if (!post || !post.poll) return { ok: false };
    if (post.poll.multi) {
      for (const opt of post.poll.options) {
        opt.votes = opt.votes || [];
        if (opt.id === optionId) {
          opt.votes = opt.votes.includes(actor) ? opt.votes.filter((x)=> x!==actor) : [...opt.votes, actor];
        }
      }
    } else {
      for (const opt of post.poll.options) {
        opt.votes = opt.votes || [];
        opt.votes = opt.id === optionId
          ? (opt.votes.includes(actor) ? opt.votes.filter((x)=> x!==actor) : [...opt.votes, actor])
          : opt.votes.filter((x)=> x!==actor);
      }
    }
    const next = { ...db, events: { ...db.events, [eventId]: { ...ev } } };
    save(next);
    return { ok: true };
  };

  const toggleLikePost = (eventId, postId) => {
    const ev = db.events[eventId];
    if (!ev) return { ok: false };
    const actor = actorIdForEvent(eventId);
    if (!actor) {
      toast("Log ind eller brug midlertidigt login for at synes godt om", 'error');
      haptic('medium');
      return { ok: false };
    }
    const post = ev.posts.find((p) => p.id === postId);
    if (!post) return { ok: false };
    post.likes = post.likes || [];
    if (post.likes.includes(actor)) post.likes = post.likes.filter((x) => x !== actor);
    else post.likes.push(actor);
    const next = { ...db, events: { ...db.events, [eventId]: { ...ev } } };
    save(next);
    const name = nameInEvent(ev, actor);
    pushNotif(`${name} synes godt om et opslag`, 'like');
    haptic('light');
    return { ok: true };
  };

  const addCommentToPost = (eventId, postId, text) => {
    const ev = db.events[eventId];
    if (!ev) return { ok: false };
    const actor = actorIdForEvent(eventId);
    if (!actor) {
      toast("Log ind eller brug midlertidigt login for at kommentere", 'error');
      haptic('medium');
      return { ok: false };
    }
    const post = ev.posts.find((p) => p.id === postId);
    if (!post) return { ok: false };
    const comment = { id: uid(), by: actor, text, at: nowIso() };
    post.comments = post.comments || [];
    post.comments.push(comment);
    const next = { ...db, events: { ...db.events, [eventId]: { ...ev } } };
    save(next);
    const name = nameInEvent(ev, actor);
    pushNotif(`${name} kommenterede på et opslag`, 'comment');
    haptic('light');
    return { ok: true };
  };

  const toggleLikeComment = (eventId, postId, commentId) => {
    const ev = db.events[eventId];
    if (!ev) return { ok: false };
    const actor = actorIdForEvent(eventId);
    if (!actor) {
      toast("Log ind eller brug midlertidigt login for at synes godt om", 'error');
      haptic('medium');
      return { ok: false };
    }
    const post = ev.posts.find((p) => p.id === postId);
    if (!post) return { ok: false };
    const comment = (post.comments || []).find((c) => c.id === commentId);
    if (!comment) return { ok: false };
    comment.likes = comment.likes || [];
    if (comment.likes.includes(actor)) comment.likes = comment.likes.filter((x) => x !== actor);
    else comment.likes.push(actor);
    const next = { ...db, events: { ...db.events, [eventId]: { ...ev } } };
    save(next);
    return { ok: true };
  };

  const addChatMessage = (eventId, text) => {
    const ev = db.events[eventId];
    if (!ev) return { ok: false };
    const by = actorIdForEvent(eventId) || 'ukendt';
    ev.chat = ev.chat || [];
    ev.chat.push({ id: uid(), by, text, at: nowIso() });
    const next = { ...db, events: { ...db.events, [eventId]: { ...ev } } };
    save(next);
    const name = nameInEvent(ev, by);
    pushNotif(`${name} skrev i chatten`, 'chat');
    return { ok: true };
  };

  // Interne invitationer (delegeret til modul)
  const sendInvites = (eventId: string, toUserIds: string[]) => {
    const ev = db.events[eventId];
    const from = me?.id || currentActorId();
    if (!ev || !from) return { ok: false, error: 'Kan ikke sende invitationer' };
    const res = sendInvitesDb(db as FlokDB, eventId, from, toUserIds);
    save(res.db as any);
    for (const inv of res.created) {
      pushNotifTo(inv.to, `Du er inviteret til ${ev.title}`, 'invite', 'high');
    }
    return { ok: true, count: res.created.length };
  };

  const acceptInvite = (inviteId: string) => {
    const next = acceptInviteDb(db as FlokDB, inviteId);
    save(next as any);
    return { ok: true };
  };

  const declineInvite = (inviteId: string) => {
    const next = declineInviteDb(db as FlokDB, inviteId);
    save(next as any);
    return { ok: true };
  };
 
  // Deling og links
const inviteUrl = (ev) => buildInviteUrl(ev);

  // UI komponenter
  const Toolbar = () => (
    <div className="flex items-center justify-between gap-2 p-2">
      <button
        className="flex items-center gap-2 cursor-pointer select-none"
        onClick={() => setRoute({ name: "home" })}
        aria-label="Gå til forside"
      >
        <Logo />
        <span className="sr-only">Flok</span>
      </button>
      <div className="flex items-center gap-2">
        <JoinButton />
        <button className={btn} aria-label="Skift tema" onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
          {theme === "light" ? <Moon size={18} aria-hidden /> : <SunMedium size={18} aria-hidden />}
          <span className="hidden sm:inline">Tema</span>
        </button>
        <button className={btn} aria-label="Skift tekststørrelse" title="Skift tekststørrelse" onClick={() => setTextScale(textScale === '1' ? '1.15' : '1')}>Aa</button>
        {me && (
          <button className={btnPrimary} aria-label="Opret begivenhed" onClick={() => setRoute({ name: "new" })}>
            <Plus size={18} aria-hidden />
            <span className="hidden sm:inline">Opret</span>
          </button>
        )}
            <button className={btn} aria-label="Notifikationer" onClick={() => setRoute({ name: "notifs" })}>
              <Bell size={18} aria-hidden />
              <span className="hidden sm:inline">Notifikationer{(db.notifications||[]).filter((n)=> n.owner===currentActorId() && !n.read).length?` (${(db.notifications||[]).filter((n)=> n.owner===currentActorId() && !n.read).length})`:''}</span>
            </button>
        {me ? (
          <button className={btn} aria-label="Log ud" onClick={logout}>
            <LogOut size={18} />
            <span className="hidden sm:inline">Log ud</span>
          </button>
        ) : (
          <button className={btn} aria-label="Log ind" onClick={() => setRoute({ name: "auth" })}>
            <LogIn size={18} />
            <span className="hidden sm:inline">Log ind</span>
          </button>
        )}
      </div>
    </div>
  );
 
  const Nav = () => {
    const item = (active, onClick, icon, label) => (
      <button
        className={`${active ? btnPrimary : btn} w-full justify-center`}
        aria-pressed={active}
        onClick={onClick}
      >
        {icon} {label}
      </button>
    );
    return (
      <div className={`${card} p-2 sticky top-2`}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {item(route.name === "home", () => setRoute({ name: "home" }), <CalendarIcon size={18} aria-hidden />, "Forside")}
          {item(route.name === "explore", () => setRoute({ name: "explore" }), <Search size={18} aria-hidden />, "Udforsk")}
          {item(route.name === "friends", () => setRoute({ name: "friends" }), <Users size={18} aria-hidden />, "Venner")}
          {me ? item(route.name === "profile" && route.id === me.id, () => setRoute({ name: "profile", id: me.id }), <UserCheck size={18} aria-hidden />, "Profil") : null}
        </div>
      </div>
    );
  };

  const BottomNav = () => {
    const item = (active, onClick, icon, label) => (
      <button
        className={`${active ? btnPrimary : btn} w-full justify-center py-3`}
        aria-pressed={active}
        onClick={onClick}
      >
        {icon}
        <span className="text-xs">{label}</span>
      </button>
    );
    return (
      <div className="md:hidden fixed bottom-2 left-0 right-0 z-40">
        <div className="max-w-3xl mx-auto px-3">
          <div className={`${card} p-2 grid grid-cols-5 gap-2`}> 
            {item(route.name === "home", () => setRoute({ name: "home" }), <CalendarIcon size={18} aria-hidden />, "Forside")}
            {item(route.name === "explore", () => setRoute({ name: "explore" }), <Search size={18} aria-hidden />, "Udforsk")}
            {item(route.name === "friends", () => setRoute({ name: "friends" }), <Users size={18} aria-hidden />, "Venner")}
            {item(route.name === "notifs", () => setRoute({ name: "notifs" }), <Bell size={18} aria-hidden />, `Notifs${(db.notifications||[]).filter((n)=> n.owner===currentActorId() && !n.read).length?` ${(db.notifications||[]).filter((n)=> n.owner===currentActorId() && !n.read).length}`:''}`)}
            {me ? item(route.name === "profile" && route.id === me.id, () => setRoute({ name: "profile", id: me.id }), <UserCheck size={18} aria-hidden />, "Profil") : null}
          </div>
        </div>
      </div>
    );
  };
 
  const Home = () => {
    if (!me) return <Landing />;
    const relevantToMe = (e) => {
      const myId = me?.id;
      if (!myId) return e.isPublic; // gæst: vis offentlige
      if (e.hostId === myId) return true;
      if ((e.cohosts || []).includes(myId)) return true;
      if ((e.attendees || {})[myId]) return true;
      return false;
    };
    const all = Object.values(db.events).filter((e) => !e.archivedAt && relevantToMe(e));
    const upcoming = all
      .filter((e) => new Date(e.endtime || e.datetime).getTime() >= Date.now())
      .sort((a, b) => +new Date(a.datetime) - +new Date(b.datetime));
    const past = all
      .filter((e) => new Date(e.endtime || e.datetime).getTime() < Date.now())
      .sort((a, b) => +new Date(b.datetime) - +new Date(a.datetime));
    const [view, setView] = useState<'upcoming' | 'past'>("upcoming");
    const [typeFilter, setTypeFilter] = useState<'alle' | 'offentlig' | 'privat'>("alle");
    const [roleFilter, setRoleFilter] = useState<'alle' | 'vaert' | 'inviteret' | 'medvaert'>("alle");
    const [q, setQ] = useState("");
    const base = view === 'upcoming' ? upcoming : past;
    const list = base
      .filter((e) => typeFilter === 'alle' || (typeFilter === 'offentlig' ? e.isPublic : !e.isPublic))
      .filter((e) => {
        if (!me) return true;
        if (roleFilter === 'alle') return true;
        if (roleFilter === 'vaert') return e.hostId === me.id;
        if (roleFilter === 'medvaert') return (e.cohosts || []).includes(me.id);
        if (roleFilter === 'inviteret') return (e.attendees || {})[me.id];
        return true;
      })
      .filter((e) => (e.title + " " + e.address).toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => (view === 'upcoming'
          ? +new Date(a.datetime) - +new Date(b.datetime)
          : +new Date(b.datetime) - +new Date(a.datetime))
      );
    return (
      <div className="space-y-4">
        <Welcome me={me} />
        <div className="flex flex-wrap items-center gap-2">
          <div className={`${card} p-2 flex items-center gap-2 w-fit`}>
            <button className={`${btn} ${view==='upcoming' ? 'ring-2 ring-sky-400' : ''}`} onClick={() => setView('upcoming')}>Kommende</button>
            <button className={`${btn} ${view==='past' ? 'ring-2 ring-sky-400' : ''}`} onClick={() => setView('past')}>Tidligere</button>
          </div>
          <div className={`${card} p-2 flex items-center gap-2 w-fit`}>
            <button className={`${btn} ${typeFilter==='alle' ? 'ring-2 ring-sky-400' : ''}`} onClick={() => setTypeFilter('alle')}>Alle</button>
            <button className={`${btn} ${typeFilter==='offentlig' ? 'ring-2 ring-sky-400' : ''}`} onClick={() => setTypeFilter('offentlig')}>Offentlige</button>
            <button className={`${btn} ${typeFilter==='privat' ? 'ring-2 ring-sky-400' : ''}`} onClick={() => setTypeFilter('privat')}>Private</button>
          </div>
          {me && (
            <div className={`${card} p-2 flex items-center gap-2 w-fit`}>
              <button className={`${btn} ${roleFilter==='alle' ? 'ring-2 ring-sky-400' : ''}`} onClick={() => setRoleFilter('alle')}>Alle roller</button>
              <button className={`${btn} ${roleFilter==='vaert' ? 'ring-2 ring-sky-400' : ''}`} onClick={() => setRoleFilter('vaert')}>Vært</button>
              <button className={`${btn} ${roleFilter==='medvaert' ? 'ring-2 ring-sky-400' : ''}`} onClick={() => setRoleFilter('medvaert')}>Medvært</button>
              <button className={`${btn} ${roleFilter==='inviteret' ? 'ring-2 ring-sky-400' : ''}`} onClick={() => setRoleFilter('inviteret')}>Inviteret</button>
            </div>
          )}
          <div className={`${card} p-2 flex items-center gap-2 w-full sm:w-auto flex-1`}>
            <Search size={18} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Søg i dine begivenheder" aria-label="Søg i dine begivenheder" className="bg-transparent outline-none flex-1" />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {list.length === 0 && (
            <div className={`${card} p-4`}>Ingen begivenheder</div>
          )}
          {list.map((ev) => (
            <EventCard key={ev.id} ev={ev} onOpen={() => goEvent(ev.id)} />
          ))}
        </div>
      </div>
    );
  };

  const Landing = () => {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className={`${card} max-w-xl w-full p-6 sm:p-8 text-center space-y-6`}>
          <div className="space-y-2">
            <div className="text-2xl sm:text-3xl font-semibold flex items-center justify-center gap-2">
              <Logo />
              <span>Flok</span>
            </div>
            <p className="text-sm sm:text-base text-zinc-700 dark:text-zinc-300">
              Kom hurtigt i gang: Opret en begivenhed, log ind som gæst via en invitation, eller log ind på din konto.
            </p>
          </div>
          <div className="grid gap-3 sm:gap-4">
            <button
              className={`${btnPrimary} min-h-14 text-base sm:text-lg px-6`}
              onClick={() => setRoute({ name: me ? 'new' : 'auth' })}
            >
              <Plus size={20} aria-hidden /> Opret begivenhed
            </button>
            <button
              className={`${btn} min-h-14 text-base sm:text-lg px-6 ring-2 ring-emerald-500/70 hover:ring-emerald-500`}
              onClick={() => setRoute({ name: 'explore' })}
              aria-describedby="guestHelp"
            >
              <UserPlus size={20} aria-hidden /> Log ind som gæst
            </button>
            <div id="guestHelp" className="text-xs text-zinc-600 dark:text-zinc-300">
              Vælg en begivenhed og brug “Midlertidigt login” på siden.
            </div>
            <button
              className={`${btn} min-h-14 text-base sm:text-lg px-6`}
              onClick={() => setRoute({ name: 'auth' })}
            >
              <LogIn size={20} aria-hidden /> Log ind
            </button>
          </div>
        </div>
      </div>
    );
  };
 
  const Explore = () => {
    const publicEvents = Object.values(db.events).filter((e) => e.isPublic && !e.archivedAt);
    const [q, setQ] = useState("");
    const filtered = publicEvents
      .filter((e) => e.title.toLowerCase().includes(q.toLowerCase()) || e.address.toLowerCase().includes(q.toLowerCase()));
    const list = filtered.sort((a, b) => {
      const ay = Object.values(a.attendees || {}).filter((x: any) => x.status === 'yes').length;
      const by = Object.values(b.attendees || {}).filter((x: any) => x.status === 'yes').length;
      if (by !== ay) return by - ay; // flest øverst
      return +new Date(a.datetime) - +new Date(b.datetime);
    });
    return (
      <div className="space-y-4">
        <div className={`${card} p-4 space-y-2`}>
          <div className="flex items-center gap-2">
            <Search size={18} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Søg offentlige begivenheder" aria-label="Søg offentlige begivenheder" className="bg-transparent outline-none flex-1" />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {list.map((ev) => (
            <EventCard key={ev.id} ev={ev} onOpen={() => goEvent(ev.id)} />
          ))}
        </div>
      </div>
    );
  };
 
  // fmtDateTimeRange nu konsolideret fra utils

  const MapEmbed: React.FC<{ address?: string }> = ({ address }) => {
    try {
      if (!address) return null;
      const q = encodeURIComponent(address);
      const src = `https://www.google.com/maps?q=${q}&output=embed`;
      return (
        <div className="w-full h-48 rounded-xl overflow-hidden ring-1 ring-black/5">
          <iframe title="Kort" src={src} width="100%" height="100%" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
        </div>
      );
    } catch { return null; }
  };

  const EventCard: React.FC<{ ev: FlokEvent; onOpen: () => void }> = ({ ev, onOpen }) => {
    const host = db.users[ev.hostId];
    const yes = Object.values(ev.attendees || {}).filter((a: RSVP) => a.status === "yes").length;
    const myStatus = me ? (ev.attendees || {})[me.id]?.status : undefined;
    return (
		  <motion.div
        layout
        className={`${card} overflow-hidden cursor-pointer hover:ring-2 hover:ring-sky-400 focus-within:ring-2 focus-within:ring-sky-400`}
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      > 
        {ev.cover ? (
          <div className="h-40 bg-cover bg-center" style={{ backgroundImage: `url(${ev.cover})` }} />
        ) : (
          <div className="h-40 bg-gradient-to-br from-sky-200 via-emerald-200 to-pink-200 dark:from-sky-900 dark:via-emerald-900 dark:to-pink-900" />
        )}
        <div className="p-4 space-y-2">
		  <div className="flex items-center justify-between gap-2">
		    <h3 className="text-lg font-semibold">{ev.title}</h3>
		    <div className="flex items-center gap-2">
		      {ev.isPublic ? <span className={chip}>Offentlig</span> : <span className={chip}>Privat</span>}
              {myStatus === 'yes' && <span className={chip}>Du deltager</span>}
              {myStatus === 'maybe' && <span className={chip}>Måske</span>}
              {myStatus === 'no' && <span className={chip}>Deltager ikke</span>}
		    </div>
		  </div>
          <p className="text-sm text-zinc-700 dark:text-zinc-300 line-clamp-2">{ev.description}</p>
          <div className="flex items-center gap-3 text-sm">
            <span className="inline-flex items-center gap-1"><Clock size={16} /> {fmtDateTimeRange(ev.datetime, ev.endtime, ev.timezone)}</span>
          </div>
          <div className="flex items-center justify-between pt-2">
            <div className="text-sm text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
              Vært <button className="underline hover:no-underline" onClick={(e)=> { e.stopPropagation(); setRoute({ name: 'profile', id: host?.id }); }}>{host?.name || "Ukendt"}</button>
              {(ev.cohosts || []).length > 0 && (
                <span className={chip}>+{(ev.cohosts || []).length} medværter</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className={chip}>{yes}{ev.maxGuests ? ` af ${ev.maxGuests}` : " deltagere"}</span>
              <button className={btn} onClick={onOpen}>Åbn</button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };
 
  const EventPage = ({ id }) => {
    const ev = db.events[id];
    if (!ev) {
      return (
        <div className={`${card} p-6 max-w-xl mx-auto space-y-3 text-center`}>
          <h3 className="text-xl font-semibold">Begivenheden blev ikke fundet</h3>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">Kontrollér linket eller invitationskoden, og prøv igen.</p>
          <div className="flex justify-center gap-2">
            <button className={btn} onClick={() => setRoute({ name: 'home' })}><ArrowLeft size={18} /> Tilbage</button>
            <button className={btn} onClick={() => setRoute({ name: 'explore' })}><Search size={18} /> Udforsk</button>
          </div>
        </div>
      );
    }
    const host = db.users[ev.hostId];
    const [tab, setTab] = useState("samtale");
    const [showInvite, setShowInvite] = useState(false);
    const [showTemp, setShowTemp] = useState(false);
    const [useLocalTz, setUseLocalTz] = useState(false);
    const seriesSiblings = React.useMemo(() => {
      if (!ev.seriesId) return [] as any[];
      return Object.values(db.events).filter((e:any) => e.seriesId === ev.seriesId).sort((a:any,b:any)=> +new Date(a.datetime) - +new Date(b.datetime));
    }, [db.events, ev.seriesId]);
 
  const attendees = ev.attendees || {};
  const yes = Object.entries(attendees).filter(([, a]) => (a as any).status === "yes");
  const no = Object.entries(attendees).filter(([, a]) => (a as any).status === "no");
  const maybe = Object.entries(attendees).filter(([, a]) => (a as any).status === "maybe");
 
    const canRSVP = () => {
      if (me) return true;
      const t = db.sessions[sessionId]?.temp;
      return t && t.eventId === id;
    };
    const canInteract = canRSVP();
 
    const myActorId = () => {
      if (me) return me.id;
      const t = db.sessions[sessionId]?.temp;
      if (t && t.eventId === id) return ev.tempAccounts[t.username]?.userId;
      return undefined;
    };
 
    const myRSVP = (() => {
      const aId = myActorId();
      if (!aId) return null;
      return ev.attendees[aId] || null;
    })();
 
    const doRSVP = async (status, withChildren = []) => {
      const res = rsvp(id, status, withChildren);
      if (!res.ok) toast(res.error || 'Kunne ikke gemme svar', 'error');
    };
 
    const onDownloadICS = () => {
      const ics = toICS(ev);
      const blob = new Blob([ics], { type: "text/calendar" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${ev.title || "begivenhed"}.ics`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 500);
    };
 
    const mapLinks = () => {
      const q = encodeURIComponent(ev.address || "");
      const apple = `https://maps.apple.com/?q=${q}`;
      const google = `https://www.google.com/maps/search/?api=1&query=${q}`;
      return { apple, google };
    };
 
    // Password gate hvis værten har sat kode
    const storageKey = `flok:entered:${ev.id}`;
    const [entered, setEntered] = useState(() => !ev.hasPassword || localStorage.getItem(storageKey) === "1");
    const [pw, setPw] = useState("");
    useEffect(() => { const ok = !ev.hasPassword || localStorage.getItem(storageKey) === "1"; setEntered(ok); setPw(""); }, [id]);
 
    if (!entered) {
      return (
        <div className={`${card} p-6 max-w-xl mx-auto text-center space-y-4`}>
          <Lock className="mx-auto" />
          <h3 className="text-xl font-semibold">Denne begivenhed er beskyttet</h3>
          <p>Indtast adgangskode fra værten</p>
          <input value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Adgangskode" aria-label="Adgangskode" className={`${card} w-full px-3 py-2 bg-transparent outline-none ring-1 ring-black/5 rounded-2xl`} />
          <button className={btnPrimary} onClick={() => { if (pw === ev.password) { localStorage.setItem(storageKey, "1"); setEntered(true); haptic('light'); toast('Åbnet', 'success'); } else { toast("Forkert adgangskode", 'error'); haptic('medium'); } }}>Fortsæt</button>
        </div>
      );
    }
 
    return (
      <div className="space-y-4">
        <button className={btn} onClick={() => setRoute({ name: "home" })}>
          <ArrowLeft size={18} /> Tilbage
        </button>
        <div className={`${card} overflow-hidden`}>
          {ev.cover ? (
            <div className="h-60 bg-cover bg-center" style={{ backgroundImage: `url(${ev.cover})` }} />
          ) : (
            <div className="h-60 bg-gradient-to-br from-sky-200 via-emerald-200 to-pink-200 dark:from-sky-900 dark:via-emerald-900 dark:to-pink-900" />
          )}
          <div className="p-4 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h1 className="text-2xl sm:text-3xl font-semibold">{ev.title}</h1>
              <div className="flex items-center gap-2">
                {ev.isPublic ? <span className={chip}>Offentlig</span> : <span className={chip}>Privat</span>}
                {ev.hasPassword ? <Lock size={18} /> : <Unlock size={18} />}
                {(ev.cohosts || []).length > 0 && (
                  <span className={chip}>Medværter: {(ev.cohosts || []).map((id) => db.users[id]?.name || 'Ukendt').slice(0,2).join(', ')}{(ev.cohosts || []).length > 2 ? '…' : ''}</span>
                )}
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-3">
                {ev.seriesId && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className={chip}>Serie {ev.seriesIndex || '?'} / {ev.seriesTotal || seriesSiblings.length}</span>
                    <div className="flex gap-2">
                      <button className={btn} disabled={!seriesSiblings.length || (ev.seriesIndex||1) <= 1} onClick={()=> {
                        const idx = seriesSiblings.findIndex((e)=> e.id === ev.id);
                        if (idx>0) setRoute({ name:'event', id: seriesSiblings[idx-1].id });
                      }}>Forrige</button>
                      <button className={btn} disabled={!seriesSiblings.length || (ev.seriesIndex||seriesSiblings.length) >= seriesSiblings.length} onClick={()=> {
                        const idx = seriesSiblings.findIndex((e)=> e.id === ev.id);
                        if (idx>=0 && idx < seriesSiblings.length-1) setRoute({ name:'event', id: seriesSiblings[idx+1].id });
                      }}>Næste</button>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <Clock size={18} /> {fmtDateTimeRange(ev.datetime, ev.endtime, useLocalTz ? undefined : ev.timezone)}
                  <button className={btn} aria-pressed={useLocalTz} onClick={() => setUseLocalTz((v) => !v)}>
                    {useLocalTz ? 'Vis i værtens tidszone' : 'Vis i min tidszone'}
                  </button>
                </div>
                <div className="flex items-center gap-2 text-sm"><MapPin size={18} /> {ev.address || "Ingen adresse"}</div>
                {ev.address && <MapEmbed address={ev.address} />}
                <div className="flex flex-wrap gap-2 pt-1">
                  <a className={btn} href={mapLinks().apple} target="_blank" rel="noreferrer"><Globe2 size={18} /> Apple Maps</a>
                  <a className={btn} href={mapLinks().google} target="_blank" rel="noreferrer"><Globe2 size={18} /> Google Maps</a>
                  <button className={btn} onClick={() => copy(ev.address).then(() => { toast('Adresse kopieret', 'success'); haptic('light'); })}><Copy size={18} aria-hidden /> Kopiér</button>
                </div>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">{ev.description}</p>
                <div className="flex flex-wrap gap-2">
                  <button className={btn} onClick={() => window.open(toGoogleCalLink(ev), "_blank") }><CalendarIcon size={18} /> Google Kalender</button>
                  <button className={btn} onClick={onDownloadICS}><Download size={18} /> Apple Kalender (.ics)</button>
                </div>
              </div>
              <div className={`${card} p-4 space-y-3`}>
                <h3 className="font-semibold">Svar på invitation</h3>
                {canRSVP() ? (
                  <RSVPPanel ev={ev} me={me} myRSVP={myRSVP} onRSVP={doRSVP} />
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm">Du skal være logget ind eller bruge et midlertidigt login for at svare</p>
                    <div className="flex flex-wrap gap-2">
                      <button className={btn} onClick={() => setRoute({ name: "auth" })}><LogIn size={18} /> Log ind</button>
                      <button className={btn} onClick={() => setShowTemp(true)}><ShieldAlert size={18} /> Midlertidigt login</button>
                    </div>
                  </div>
                )}
                <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 text-sm space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={chip}>Max {ev.maxGuests || "uendeligt"}</span>
                    {ev.waitlist && <span className={chip}>Venteliste</span>}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <div>
                      Vært {host ? (
                        <button className="font-semibold hover:underline" onClick={() => setRoute({ name: 'profile', id: host.id })}>{host.name}</button>
                      ) : (
                        <span className="font-semibold">Ukendt</span>
                      )}
                    </div>
                    {me && host && me.id !== host.id && (() => {
                      const st = friendStatus(me.id, host.id);
                    if (st === 'friends') return <button className={btn} onClick={async () => { if (await askConfirm({ title: 'Fjern ven', message: 'Er du sikker på, at du vil fjerne denne ven?', confirmText: 'Fjern', cancelText: 'Behold' })) { const before = { me: me.id, other: host.id }; unfriend(host.id); toastAction('Fjernet som ven', 'Fortryd', () => { const a = db.users[before.me]; const b = db.users[before.other]; if (a && b) { a.friends = [...(a.friends||[]), before.other]; b.friends = [...(b.friends||[]), before.me]; save({ ...db, users: { ...db.users, [a.id]: a, [b.id]: b }, friendships: [...(db.friendships||[]), { id: uid(), a: a.id, b: b.id, createdAt: nowIso() }] }); } }); } }}>Fjern ven</button>;
                    if (st === 'outgoing') return <button className={btn} disabled><Hourglass size={16} aria-hidden /> Anmodet</button>;
                    if (st === 'incoming') return <button className={btn} onClick={() => { acceptFriendRequest(host.id); toast('Venneanmodning accepteret', 'success'); haptic('light'); }}><Check size={16} aria-hidden /> Acceptér</button>;
                    return <button className={btn} onClick={() => { befriend(host.id); toast('Venneanmodning sendt', 'info'); }}><UserPlus size={16} aria-hidden /> Tilføj ven</button>;
                    })()}
                  </div>
                  {(ev.cohosts || []).length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-medium">Medværter</div>
                      {(ev.cohosts || []).map((cid) => (
                        <span key={cid} className="inline-flex items-center gap-2">
                          <button className="hover:underline" onClick={() => setRoute({ name: 'profile', id: cid })}>{db.users[cid]?.name || 'Ukendt'}</button>
                          {me && cid !== me.id && db.users[cid] && (() => {
                            const st = friendStatus(me.id, cid);
                            if (st === 'friends') return <button className={btn} onClick={async () => { if (await askConfirm({ title: 'Fjern ven', message: 'Er du sikker på, at du vil fjerne denne ven?', confirmText: 'Fjern', cancelText: 'Behold' })) { const before = { me: me.id, other: cid }; unfriend(cid); toastAction('Fjernet som ven', 'Fortryd', () => { const a = db.users[before.me]; const b = db.users[before.other]; if (a && b) { a.friends = [...(a.friends||[]), before.other]; b.friends = [...(b.friends||[]), before.me]; save({ ...db, users: { ...db.users, [a.id]: a, [b.id]: b }, friendships: [...(db.friendships||[]), { id: uid(), a: a.id, b: b.id, createdAt: nowIso() }] }); } }); } }}>Fjern ven</button>;
                            if (st === 'outgoing') return <button className={btn} disabled><Hourglass size={14} /> Anmodet</button>;
                            if (st === 'incoming') return <button className={btn} onClick={() => acceptFriendRequest(cid)}><Check size={14} /> Acceptér</button>;
                            return <button className={btn} onClick={() => befriend(cid)} title="Tilføj som ven"><UserPlus size={14} /></button>;
                          })()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
 
            <div className="flex flex-wrap gap-2">
              <button className={btn} onClick={() => setShowInvite(true)}><Share2 size={18} /> Del og inviter</button>
              <button className={`${tab === 'samtale' ? btnPrimary : btn}`} aria-pressed={tab === 'samtale'} onClick={() => setTab("samtale")}><MessageSquare size={18} /> Samtale</button>
              <button className={`${tab === 'gaesteliste' ? btnPrimary : btn}`} aria-pressed={tab === 'gaesteliste'} onClick={() => setTab("gaesteliste")}><Users size={18} /> Gæster</button>
              {me && me.id === ev.hostId && (
                <button className={`${tab === 'manage' ? btnPrimary : btn}`} aria-pressed={tab === 'manage'} onClick={() => setTab("manage")}><Settings size={18} /> Værtstyring</button>
              )}
            </div>

            {ev.inviteToken && (
              <div className="text-xs text-zinc-600 dark:text-zinc-300">
                Invitationskode: <code className="font-mono">{ev.inviteToken}</code> — indtastes under “Deltag med kode”.
              </div>
            )}

            {tab === "samtale" && (
              <Conversation
                ev={ev}
                isHost={me?.id === ev.hostId || (ev.cohosts || []).includes(me?.id || '')}
                canInteract={canInteract}
              />
            )}
            {tab === "gaesteliste" && <GuestList ev={ev} db={db} onPromote={(uid) => promoteFromWaitlist(ev.id, uid)} />}
            {tab === "manage" && me?.id === ev.hostId && <Manage ev={ev} db={db} onSave={(updated) => { const next = { ...db, events: { ...db.events, [ev.id]: updated } }; save(next); }} />}
          </div>
        </div>
 
        <InviteDialog open={showInvite} onClose={() => setShowInvite(false)} ev={ev} friends={me ? me.friends : []} db={db} onSendInvites={sendInvites} copy={copy} webShare={webShare} />
        <TempLoginDialog open={showTemp} onClose={() => setShowTemp(false)} onCreate={(u, p) => createTempLogin(ev.id, u, p)} onAuth={(u, p) => authTemp(ev.id, u, p)} />
      </div>
    );
  };
 
  const RSVPPanel = ({ ev, me, myRSVP, onRSVP }) => {
    const [childrenPicked, setChildrenPicked] = useState([]);
    useEffect(() => setChildrenPicked(myRSVP?.withChildren || []), [myRSVP?.withChildren?.join(",")]);
    const isParent = me?.isParent;
    useEffect(() => { if (myRSVP?.status) setPingKey((k)=> k+1); }, [myRSVP?.status]);
    const [pingKey, setPingKey] = useState(0);
    const lockMsg = () => {
      const policy = ev.rsvpPolicy?.type || "none";
      if (policy === "deadline" || policy === "both") {
        if (ev.rsvpPolicy.deadline) return `Svar senest ${fmtDateTime(ev.rsvpPolicy.deadline)}`;
      }
      return null;
    };
    return (
      <div className="space-y-3">
        {isParent && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Vælg hvilke børn der deltager</div>
            <div className="flex flex-wrap gap-2">
              {me.children.map((c) => (
                <label key={c.id} className={`cursor-pointer inline-flex items-center min-h-11 ${chip} ${childrenPicked.includes(c.id) ? 'ring-2 ring-sky-400' : ''}`}>
                  <input type="checkbox" checked={childrenPicked.includes(c.id)} onChange={(e) => {
                    setChildrenPicked((prev) => e.target.checked ? [...prev, c.id] : prev.filter((x) => x !== c.id));
                  }} className="hidden" />
                  {c.name} {c.age}
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          <button
            className={`${btnPrimary} ${myRSVP?.status === 'yes' ? 'ring-2 ring-sky-400' : ''}`}
            aria-pressed={myRSVP?.status === 'yes'}
            onClick={() => onRSVP("yes", childrenPicked)}
          >
            <UserCheck size={18} /> Deltager {myRSVP?.status === 'yes' && <Check size={16} />}
          </button>
          <button
            className={`${btn} ${myRSVP?.status === 'maybe' ? 'ring-2 ring-sky-400 bg-zinc-200 dark:bg-zinc-700' : ''}`}
            aria-pressed={myRSVP?.status === 'maybe'}
            onClick={() => onRSVP("maybe", childrenPicked)}
          >
            Måske {myRSVP?.status === 'maybe' && <Check size={16} />}
          </button>
          <button
            className={`${btn} ${myRSVP?.status === 'no' ? 'ring-2 ring-sky-400 bg-zinc-200 dark:bg-zinc-700' : ''}`}
            aria-pressed={myRSVP?.status === 'no'}
            onClick={() => onRSVP("no", [])}
          >
            Deltager ikke {myRSVP?.status === 'no' && <Check size={16} />}
          </button>
        </div>
        {myRSVP && (
          <div className="text-sm flex items-center gap-2" aria-live="polite">
            <span>Dit svar er registreret som <strong>{myRSVP.status === "yes" ? "Deltager" : myRSVP.status === "no" ? "Deltager ikke" : "Måske"}</strong></span>
            <SuccessPing key={pingKey} />
          </div>
        )}
        {lockMsg() && <div className="text-xs text-zinc-600 dark:text-zinc-300">{lockMsg()}</div>}
      </div>
    );
  };
 
  // InviteDialog flyttet til komponentfil

  // InviteByContact og EmailComposer flyttet ind i InviteDialog komponentfil
 
  // TempLoginDialog flyttet til komponentfil
 
  const Posts = ({ ev, isHost, canInteract, onAdd, onPin, onDel, onLike, onComment }) => {
    const [text, setText] = useState("");
    const [files, setFiles] = useState([]);
    const canGuestPost = (ev.allowGuestPosts || isHost) && canInteract;
    const [drafts, setDrafts] = useState({});
    return (
      <div className="space-y-3">
        {canGuestPost && (
          <div className={`${card} p-4 space-y-2`}>
            <div className="text-sm font-medium">Skriv et opslag</div>
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Hvad vil du dele" className={`w-full h-24 bg-transparent outline-none ${card} p-3`} />
            <div className="flex items-center justify-between">
              <input type="file" accept="image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} />
              <div className="flex gap-2">
                {isHost && (
                  <button
                    className={btn}
                    onClick={() => {
                      onAdd(text.trim(), files, "host");
                      setText("");
                      setFiles([]);
                    }}
                  >
                    <BellRing size={18} /> Del som vært
                  </button>
                )}
                <button
                  className={btn}
                  onClick={() => {
                    onAdd(text.trim(), files, "guest");
                    setText("");
                    setFiles([]);
                  }}
                >
                  <MessageSquare size={18} /> Del
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="space-y-2">
          {ev.posts.length === 0 && (
            <div className={`${card} p-4 text-sm`}>Ingen opslag endnu</div>
          )}
          {ev.posts
            .slice()
            .sort((a, b) => (a.pinned === b.pinned ? 0 : a.pinned ? -1 : 1))
            .map((p) => (
            <div key={p.id} className={`${card} p-4 space-y-2`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {p.type === "host" ? <BellRing size={16} /> : <MessageSquare size={16} />}
                  <div className="text-sm text-zinc-700 dark:text-zinc-300">
                    {new Date(p.at).toLocaleString()}
                  </div>
                  <div className="text-sm">
                    af <strong>{nameInEvent(ev, p.by)}</strong>
                    {me && p.by && me.id !== p.by && db.users[p.by] && (() => {
                      const st = friendStatus(me.id, p.by);
                        if (st === 'friends') return <button className={btn + ' ml-2'} onClick={async () => { if (await askConfirm({ title: 'Fjern ven', message: 'Er du sikker på, at du vil fjerne denne ven?', confirmText: 'Fjern', cancelText: 'Behold' })) { const before = { me: me.id, other: p.by }; unfriend(p.by); toastAction('Fjernet som ven', 'Fortryd', () => { const a = db.users[before.me]; const b = db.users[before.other]; if (a && b) { a.friends = [...(a.friends||[]), before.other]; b.friends = [...(b.friends||[]), before.me]; save({ ...db, users: { ...db.users, [a.id]: a, [b.id]: b }, friendships: [...(db.friendships||[]), { id: uid(), a: a.id, b: b.id, createdAt: nowIso() }] }); } }); } }}>Fjern ven</button>;
                      if (st === 'outgoing') return <button className={btn + ' ml-2'} disabled><Hourglass size={14} /> Anmodet</button>;
                      if (st === 'incoming') return <button className={btn + ' ml-2'} onClick={() => acceptFriendRequest(p.by)}><Check size={14} /> Acceptér</button>;
                      return <button className={btn + ' ml-2'} onClick={() => befriend(p.by)}><UserPlus size={14} /> Tilføj ven</button>;
                    })()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isHost && (
                    <>
                      <button
                        className={btn}
                        onClick={() => onPin(p.id, !p.pinned)}
                        title={p.pinned ? "Frigør" : "Fastgør"}
                        aria-label={p.pinned ? "Frigør opslag" : "Fastgør opslag"}
                      >
                        {p.pinned ? <PinOff size={16} /> : <PinIcon size={16} />}
                      </button>
                      <button
                        className={btn}
                        onClick={() => onDel(p.id)}
                        title="Slet"
                        aria-label="Slet opslag"
                      >
                        <X size={16} />
                      </button>
                    </>
                  )}
                </div>
              </div>
              {p.pinned && (
                <div className="text-xs inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 ring-1 ring-black/5 w-fit">
                  <PinIcon size={12} /> Fastgjort
                </div>
              )}
              <div className="whitespace-pre-wrap text-sm">{p.text}</div>
              {p.images?.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {p.images.map((src, i) => (
                    <img key={i} src={src} alt={`Opslagsbillede ${i+1}`} className="rounded-xl ring-1 ring-black/5 w-full h-36 object-cover" />
                  ))}
                </div>
              )}
              <div className="pt-2 flex items-center justify-between">
                <button
                  className={btn}
                  disabled={!canInteract}
                  title={canInteract ? "Synes godt om" : "Log ind for at synes godt om"}
                  onClick={() => onLike(p.id)}
                >
                  <Heart size={16} /> Synes godt om ({(p.likes || []).length})
                </button>
              </div>
              {(p.likes || []).length > 0 && (
                <div className="text-xs text-zinc-700 dark:text-zinc-300 flex flex-wrap gap-2 items-center">
                  <span>Synes godt om:</span>
                  {(p.likes || []).map((uid) => (
                    <span key={uid} className="inline-flex items-center gap-1">
                      <span className={chip}>{nameInEvent(ev, uid)}</span>
                      {me && uid !== me.id && db.users[uid] && (() => {
                        const st = friendStatus(me.id, uid);
                              if (st === 'friends') return <button className={btn} onClick={() => { if (confirm('Fjerne som ven?')) { unfriend(uid); toast('Fjernet som ven', 'info'); } }}>Fjern ven</button>;
                        if (st === 'outgoing') return <button className={btn} disabled><Hourglass size={12} /> Anmodet</button>;
                        if (st === 'incoming') return <button className={btn} onClick={() => acceptFriendRequest(uid)}><Check size={12} /> Acceptér</button>;
                        return <button className={btn} onClick={() => befriend(uid)} title="Tilføj som ven"><UserPlus size={12} /></button>;
                      })()}
                    </span>
                  ))}
                </div>
              )}
              <div className="space-y-2">
                {(p.comments || []).map((c) => (
                  <div key={c.id} className="text-sm">
                    <span className="font-medium">{nameInEvent(ev, c.by)}</span>: {c.text}
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <input
                    className={`${card} flex-1 px-3 py-2 bg-transparent`}
                    placeholder={canInteract ? "Skriv en kommentar" : "Log ind for at kommentere"}
                    value={drafts[p.id] || ""}
                    onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                    disabled={!canInteract}
                  />
                  <button
                    className={btn}
                    disabled={!canInteract || !(drafts[p.id] || "").trim()}
                    onClick={() => {
                      const t = (drafts[p.id] || "").trim();
                      if (!t) return;
                      onComment(p.id, t);
                      setDrafts((d) => ({ ...d, [p.id]: "" }));
                    }}
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  type ConversationItem =
    | { kind: 'post'; id: string; at: string; pinned: boolean; post: Post }
    | { kind: 'chat'; id: string; at: string; chat: FlokEvent['chat'][number] };

  const Conversation: React.FC<{ ev: FlokEvent; isHost: boolean; canInteract: boolean }> = ({ ev, isHost, canInteract }) => {
    // Opslag
    const [postText, setPostText] = useState<string>("");
    const [postFiles, setPostFiles] = useState<File[]>([]);
    // Afstemning
    const [q, setQ] = useState<string>("");
    const [opts, setOpts] = useState<string[]>(["", ""]);
    const [multi, setMulti] = useState<boolean>(false);
    const [pollPing, setPollPing] = useState<number>(0);
    // Hurtig besked (chat)
    const [msg, setMsg] = useState<string>("");

    const allItems = React.useMemo<ConversationItem[]>(() => {
      const ps = (ev.posts || []).map((p) => ({
        kind: 'post' as const,
        id: p.id,
        at: p.at,
        pinned: !!p.pinned,
        post: p,
      }));
      const cs = (ev.chat || []).map((c) => ({
        kind: 'chat' as const,
        id: c.id,
        at: c.at,
        chat: c,
      }));
      return [...ps, ...cs].sort((a, b) => {
        if (a.kind === 'post' && b.kind === 'post') {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        }
        return +new Date(b.at) - +new Date(a.at);
      });
    }, [ev.posts, ev.chat, pollPing]);

    const sendMsg = () => {
      if (!canInteract) return;
      const t = (msg || '').trim();
      if (!t) return;
      addChatMessage(ev.id, t);
      setMsg("");
    };

    return (
      <div className="lg:grid lg:grid-cols-3 lg:gap-4 lg:items-start">
        <div className="lg:col-span-2 space-y-2">
          {allItems.length === 0 && <div className={`${card} p-4 text-sm`}>Ingen aktivitet endnu</div>}
          {allItems.map((it:any) => {
            if (it.kind === 'chat') {
              const m = it.chat;
              return (
                <div key={`chat-${m.id}`} className={`${card} p-3`}>
                  <div className="text-xs text-zinc-600 dark:text-zinc-300">{nameInEvent(ev, m.by)} · {new Date(m.at).toLocaleString()}</div>
                  {m.text && <div className="text-sm">{m.text}</div>}
                </div>
              );
            }
            const p = it.post;
            return (
              <div key={`post-${p.id}`} className={`${card} p-4 space-y-2`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                  {p.type === 'host' ? <BellRing size={16} /> : p.type === 'poll' ? <Filter size={16} /> : <MessageSquare size={16} />}
                    <div className="text-sm text-zinc-700 dark:text-zinc-300">{new Date(p.at).toLocaleString()}</div>
                    <div className="text-sm">
                      af <strong>{nameInEvent(ev, p.by)}</strong>
                      {me && p.by && me.id !== p.by && db.users[p.by] && (() => {
                        const st = friendStatus(me.id, p.by);
                        if (st === 'friends') return <button className={btn + ' ml-2'} onClick={() => { if (confirm('Fjerne som ven?')) { unfriend(p.by); toast('Fjernet som ven', 'info'); } }}>Fjern ven</button>;
                        if (st === 'outgoing') return <button className={btn + ' ml-2'} disabled><Hourglass size={14} /> Anmodet</button>;
                        if (st === 'incoming') return <button className={btn + ' ml-2'} onClick={() => acceptFriendRequest(p.by)}><Check size={14} /> Acceptér</button>;
                        return <button className={btn + ' ml-2'} onClick={() => befriend(p.by)}><UserPlus size={14} /> Tilføj ven</button>;
                      })()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isHost && p.type !== 'poll' && (
                      <>
                        <button className={btn} onClick={() => pinPost(ev.id, p.id, !p.pinned)} title={p.pinned ? 'Frigør' : 'Fastgør'} aria-label={p.pinned ? 'Frigør opslag' : 'Fastgør opslag'}>
                          {p.pinned ? <PinOff size={16} /> : <PinIcon size={16} />}
                        </button>
                        <button className={btn} onClick={() => deletePost(ev.id, p.id)} title="Slet" aria-label="Slet opslag">
                          <X size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {p.pinned && (
                  <div className="text-xs inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 ring-1 ring-black/5 w-fit">
                    <PinIcon size={12} /> Fastgjort
                  </div>
                )}
                {p.type === 'poll' ? (
                  <div className="space-y-2">
                    <div className="text-sm font-medium">{p.poll?.question}</div>
                    <div className="space-y-1">
                      {p.poll?.options.map((o:any)=> (
                        <div key={o.id} className="flex items-center justify-between">
                          <button className={btn} disabled={!canInteract} onClick={()=> votePoll(ev.id, p.id, o.id)}>{o.text}</button>
                          <span className="text-xs text-zinc-600 dark:text-zinc-300">{(o.votes||[]).length} stemmer</span>
                        </div>
                      ))}
                    </div>
                    <div className="text-xs text-zinc-600 dark:text-zinc-300">
                      {p.poll?.options.flatMap((o:any) => (o.votes||[]).map((uid:any) => nameInEvent(ev, uid))).join(', ')}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="whitespace-pre-wrap text-sm">{p.text}</div>
                    {p.images?.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {p.images.map((src:string, i:number) => (
                          <img key={i} src={src} className="rounded-xl ring-1 ring-black/5 w-full h-36 object-cover" />
                        ))}
                      </div>
                    )}
                    <div className="pt-2 flex items-center justify-between">
                      <button className={btn} disabled={!canInteract} title={canInteract ? 'Synes godt om' : 'Log ind for at synes godt om'} onClick={() => toggleLikePost(ev.id, p.id)}>
                        <Heart size={16} /> Synes godt om ({(p.likes || []).length})
                      </button>
                    </div>
                    {(p.likes || []).length > 0 && (
                      <div className="text-xs text-zinc-700 dark:text-zinc-300 flex flex-wrap gap-2 items-center">
                        <span>Synes godt om:</span>
                        {(p.likes || []).map((uid:any) => (
                          <span key={uid} className="inline-flex items-center gap-1">
                            <span className={chip}>{nameInEvent(ev, uid)}</span>
                            {me && uid !== me.id && db.users[uid] && (() => {
                              const st = friendStatus(me.id, uid);
                        if (st === 'friends') return <button className={btn} onClick={async () => { if (await askConfirm({ title: 'Fjern ven', message: 'Er du sikker på, at du vil fjerne denne ven?', confirmText: 'Fjern', cancelText: 'Behold' })) { const before = { me: me.id, other: uid }; unfriend(uid); toastAction('Fjernet som ven', 'Fortryd', () => { const a = db.users[before.me]; const b = db.users[before.other]; if (a && b) { a.friends = [...(a.friends||[]), before.other]; b.friends = [...(b.friends||[]), before.me]; save({ ...db, users: { ...db.users, [a.id]: a, [b.id]: b }, friendships: [...(db.friendships||[]), { id: uid(), a: a.id, b: b.id, createdAt: nowIso() }] }); } }); } }}>Fjern ven</button>;
                              if (st === 'outgoing') return <button className={btn} disabled><Hourglass size={12} /> Anmodet</button>;
                              if (st === 'incoming') return <button className={btn} onClick={() => acceptFriendRequest(uid)}><Check size={12} /> Acceptér</button>;
                              return <button className={btn} onClick={() => befriend(uid)} title="Tilføj som ven"><UserPlus size={12} /></button>;
                            })()}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="space-y-2">
                      {(p.comments || []).map((c:any) => (
                        <div key={c.id} className="text-sm">
                          <span className="font-medium">{nameInEvent(ev, c.by)}</span>: {c.text}
                        </div>
                      ))}
                      <div className="flex items-center gap-2">
                        <input className={`${card} flex-1 px-3 py-2 bg-transparent`} placeholder={canInteract ? 'Skriv en kommentar' : 'Log ind for at kommentere'} aria-label="Kommentar"
                          onKeyDown={(e:any)=> { if (e.key==='Enter') { const t = (e.target.value||'').trim(); if (t) { addCommentToPost(ev.id, p.id, t); e.target.value=''; } } }} />
                        <button className={btn} disabled={!canInteract} onClick={(e:any) => { const input = (e.currentTarget.previousSibling as any); const t = (input?.value || '').trim(); if (!t) return; addCommentToPost(ev.id, p.id, t); input.value=''; }}>Send</button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
        <div className="space-y-4 mt-4 lg:mt-0 lg:sticky lg:top-4">
          <div className={`${card} p-4 space-y-3`}>
            <div className="text-sm font-medium">Del opslag</div>
            <textarea value={postText} onChange={(e) => setPostText(e.target.value)} placeholder="Skriv et opslag" className={`w-full h-24 bg-transparent outline-none ${card} p-3`} />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <input type="file" accept="image/*" multiple onChange={(e) => setPostFiles(Array.from(e.target.files || []))} />
              <div className="flex flex-wrap gap-2">
                {isHost && (
                  <button className={btn} onClick={() => { addPost(ev.id, postText.trim(), postFiles, 'host'); setPostText(''); setPostFiles([]); }}>
                    <BellRing size={18} /> Del som vært
                  </button>
                )}
                <button className={btn} onClick={() => { addPost(ev.id, postText.trim(), postFiles, 'guest'); setPostText(''); setPostFiles([]); }}>
                  <MessageSquare size={18} /> Del
                </button>
              </div>
            </div>
          </div>

          {isHost && (
            <div className={`${card} p-4 space-y-2`}>
              <div className="text-sm font-medium flex items-center gap-2">Opret afstemning {pollPing > 0 && <SuccessPing key={pollPing} />}</div>
              <input className={`${card} px-3 py-2 bg-transparent w-full`} placeholder="Spørgsmål" aria-label="Afstemningsspørgsmål" value={q} onChange={(e)=> setQ(e.target.value)} />
              <div className="space-y-1">
                {opts.map((o,i)=> (
                  <input key={i} className={`${card} px-3 py-2 bg-transparent w-full`} placeholder={`Valgmulighed ${i+1}`} aria-label={`Valgmulighed ${i+1}`} value={o} onChange={(e)=> setOpts((arr)=> arr.map((x,idx)=> idx===i? e.target.value : x))} />
                ))}
              </div>
              <label className="text-sm inline-flex items-center gap-2">
                <input type="checkbox" checked={multi} onChange={(e)=> setMulti(e.target.checked)} />
                Tillad flere valg
              </label>
              <div className="flex gap-2">
                <button className={btn} onClick={()=> setOpts((a)=> [...a, ""]) }>Flere muligheder</button>
                <button className={btnPrimary} onClick={()=> { const ready = opts.map(s=>s.trim()).filter(Boolean); if (!q.trim() || ready.length<2) { toast('Mindst to valgmuligheder', 'error'); haptic('medium'); return; } addPoll(ev.id, q.trim(), ready, multi); toast('Afstemning oprettet', 'success'); haptic('light'); setQ(''); setOpts(['','']); setMulti(false); setPollPing((k)=>k+1); }}>
                  Opret
                </button>
              </div>
            </div>
          )}

          <div className={`${card} p-4 space-y-2`}>
            <div className="text-sm font-medium">Hurtig besked</div>
            <div className="flex flex-wrap items-center gap-2">
              <input className={`${card} px-3 py-2 bg-transparent flex-1`} placeholder={canInteract? 'Skriv besked' : 'Log ind for at skrive'} aria-label="Besked" value={msg} onChange={(e)=> setMsg(e.target.value)} disabled={!canInteract} />
              <button className={btnPrimary} onClick={sendMsg} disabled={!canInteract}>Send</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const GuestList: React.FC<{ ev: FlokEvent; db: FlokDB; onPromote: (id: string) => void }> = ({ ev, db, onPromote }) => {
    const entries = Object.entries(ev.attendees || {}) as Array<[string, RSVP]>;
    const yes = entries.filter(([, a]) => a.status === "yes");
    const no = entries.filter(([, a]) => a.status === "no");
    const maybe = entries.filter(([, a]) => a.status === "maybe");
    const nameOf = (id: string) => nameInEvent(ev, id);
    const canSeePhone = me && (me.id === ev.hostId || (ev.cohosts || []).includes(me.id));
    return (
      <div className="grid lg:grid-cols-3 gap-4">
        <div className={`${card} p-4 space-y-2`}>
          <h3 className="font-semibold flex items-center gap-2"><UserCheck size={18} /> Deltager</h3>
          {yes.length === 0 && <div className="text-sm">Ingen</div>}
          {yes.map(([id, a]) => (
            <div key={id} className="text-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button className="hover:underline" onClick={() => setRoute({ name: 'profile', id })}>{nameOf(id)}</button>
                {canSeePhone && db.users[id]?.phone && (
                <span className="text-xs text-zinc-600 dark:text-zinc-300">{db.users[id].phone}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {a.withChildren?.length > 0 && (
                  <span className={chip}>{a.withChildren.length} barn</span>
                )}
                <span className="text-xs text-zinc-600 dark:text-zinc-300">{new Date(a.at).toLocaleString()}</span>
                {canSeePhone && db.users[id]?.phone && (
                  <a className={btn} href={`tel:${db.users[id].phone}`} title="Ring"><Phone size={14} /></a>
                )}
                {me && id !== me.id && db.users[id] && (
                  (() => { const st = friendStatus(me.id, id);
                    if (st === 'friends') return <button className={btn} onClick={async () => { if (await askConfirm({ title: 'Fjern ven', message: 'Er du sikker på, at du vil fjerne denne ven?', confirmText: 'Fjern', cancelText: 'Behold' })) { const before = { me: me.id, other: id }; unfriend(id); toastAction('Fjernet som ven', 'Fortryd', () => { const a = db.users[before.me]; const b = db.users[before.other]; if (a && b) { a.friends = [...(a.friends||[]), before.other]; b.friends = [...(b.friends||[]), before.me]; save({ ...db, users: { ...db.users, [a.id]: a, [b.id]: b }, friendships: [...(db.friendships||[]), { id: uid(), a: a.id, b: b.id, createdAt: nowIso() }] }); } }); } }}>Fjern ven</button>;
                    if (st === 'outgoing') return <button className={btn} disabled><Hourglass size={14} /> Anmodet</button>;
                    if (st === 'incoming') return <button className={btn} onClick={() => acceptFriendRequest(id)}><Check size={14} /> Acceptér</button>;
                    return <button className={btn} onClick={() => befriend(id)} title="Tilføj som ven"><UserPlus size={14} /></button>;
                  })()
                )}
              </div>
            </div>
          ))}
        </div>
        <div className={`${card} p-4 space-y-2`}>
          <h3 className="font-semibold">Måske</h3>
          {maybe.length === 0 && <div className="text-sm">Ingen</div>}
          {maybe.map(([id, a]) => (
            <div key={id} className="text-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button className="hover:underline" onClick={() => setRoute({ name: 'profile', id })}>{nameOf(id)}</button>
                {canSeePhone && db.users[id]?.phone && (
                  <span className="text-xs text-zinc-600 dark:text-zinc-300">{db.users[id].phone}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {ev.waitlist && ev.waitlistQueue.includes(id) && (
                  <span className={chip}>Venteliste</span>
                )}
                {ev.waitlist && ev.waitlistQueue.includes(id) && (
                  <button className={btn} onClick={() => onPromote(id)}>Promovér</button>
                )}
                <span className="text-xs text-zinc-600 dark:text-zinc-300">{new Date(a.at).toLocaleString()}</span>
                {canSeePhone && db.users[id]?.phone && (
                  <a className={btn} href={`tel:${db.users[id].phone}`} title="Ring"><Phone size={14} /></a>
                )}
                {me && id !== me.id && db.users[id] && (
                  (() => { const st = friendStatus(me.id, id);
                    if (st === 'friends') return <button className={btn} onClick={async () => { if (await askConfirm({ title: 'Fjern ven', message: 'Er du sikker på, at du vil fjerne denne ven?', confirmText: 'Fjern', cancelText: 'Behold' })) { const before = { me: me.id, other: id }; unfriend(id); toastAction('Fjernet som ven', 'Fortryd', () => { const a = db.users[before.me]; const b = db.users[before.other]; if (a && b) { a.friends = [...(a.friends||[]), before.other]; b.friends = [...(b.friends||[]), before.me]; save({ ...db, users: { ...db.users, [a.id]: a, [b.id]: b }, friendships: [...(db.friendships||[]), { id: uid(), a: a.id, b: b.id, createdAt: nowIso() }] }); } }); } }}>Fjern ven</button>;
                    if (st === 'outgoing') return <button className={btn} disabled><Hourglass size={14} /> Anmodet</button>;
                    if (st === 'incoming') return <button className={btn} onClick={() => acceptFriendRequest(id)}><Check size={14} /> Acceptér</button>;
                    return <button className={btn} onClick={() => befriend(id)} title="Tilføj som ven"><UserPlus size={14} /></button>;
                  })()
                )}
              </div>
            </div>
          ))}
        </div>
        <div className={`${card} p-4 space-y-2`}>
          <h3 className="font-semibold">Deltager ikke</h3>
          {no.length === 0 && <div className="text-sm">Ingen</div>}
          {no.map(([id]) => (
            <div key={id} className="text-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button className="hover:underline" onClick={() => setRoute({ name: 'profile', id })}>{nameOf(id)}</button>
                {canSeePhone && db.users[id]?.phone && (
                  <span className="text-xs text-zinc-600 dark:text-zinc-300">{db.users[id].phone}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {canSeePhone && db.users[id]?.phone && (
                  <a className={btn} href={`tel:${db.users[id].phone}`} title="Ring"><Phone size={14} /></a>
                )}
                {me && id !== me.id && db.users[id] && (
                  (() => { const st = friendStatus(me.id, id);
                    if (st === 'friends') return <button className={btn} onClick={async () => { if (await askConfirm({ title: 'Fjern ven', message: 'Er du sikker på, at du vil fjerne denne ven?', confirmText: 'Fjern', cancelText: 'Behold' })) { const before = { me: me.id, other: id }; unfriend(id); toastAction('Fjernet som ven', 'Fortryd', () => { const a = db.users[before.me]; const b = db.users[before.other]; if (a && b) { a.friends = [...(a.friends||[]), before.other]; b.friends = [...(b.friends||[]), before.me]; save({ ...db, users: { ...db.users, [a.id]: a, [b.id]: b }, friendships: [...(db.friendships||[]), { id: uid(), a: a.id, b: b.id, createdAt: nowIso() }] }); } }); } }}>Fjern ven</button>;
                    if (st === 'outgoing') return <button className={btn} disabled><Hourglass size={14} /> Anmodet</button>;
                    if (st === 'incoming') return <button className={btn} onClick={() => acceptFriendRequest(id)}><Check size={14} /> Acceptér</button>;
                    return <button className={btn} onClick={() => befriend(id)} title="Tilføj som ven"><UserPlus size={14} /></button>;
                  })()
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const Manage: React.FC<{ ev: FlokEvent; db: FlokDB; onSave: (ev: FlokEvent) => void }> = ({ ev, db, onSave }) => {
    type ManageFormState = {
      title: string;
      cover: string;
      description: string;
      address: string;
      datetime: string;
      endtime: string;
      timezone: string;
      isPublic: boolean;
      hasPassword: boolean;
      password: string;
      cohosts: string[];
      allowGuestPosts: boolean;
      notifyOnHostPost: boolean;
      maxGuests: string;
      waitlist: boolean;
      autoPromote: boolean;
      rsvpPolicy: 'none' | 'deadline' | 'max' | 'both';
      deadline: string;
    };

    const [form, setForm] = useState<ManageFormState>(() => ({
      title: ev.title,
      cover: ev.cover || "",
      description: ev.description || "",
      address: ev.address || "",
      datetime: ev.datetime.slice(0, 16),
      endtime: (ev.endtime || new Date(new Date(ev.datetime).getTime() + 2 * 60 * 60 * 1000).toISOString()).slice(0, 16),
      timezone: ev.timezone,
      isPublic: ev.isPublic,
      hasPassword: ev.hasPassword,
      password: ev.password || "",
      cohosts: ev.cohosts || [],
      allowGuestPosts: ev.allowGuestPosts,
      notifyOnHostPost: ev.notifyOnHostPost,
      maxGuests: ev.maxGuests != null ? String(ev.maxGuests) : "",
      waitlist: ev.waitlist,
      autoPromote: ev.autoPromote ?? false,
      rsvpPolicy: ev.rsvpPolicy?.type || "none",
      deadline: ev.rsvpPolicy?.deadline ? ev.rsvpPolicy.deadline.slice(0, 16) : "",
    }));

    const update = <K extends keyof ManageFormState>(key: K, value: ManageFormState[K]) =>
      setForm((f) => ({ ...f, [key]: value }));
    const [applySeries, setApplySeries] = useState(false);

    const onPickCover = async (file?: File) => {
      if (!file) return;
      const res = await compressImage(file, 1800, 0.85);
      update("cover", (res as { dataUrl?: string } | undefined)?.dataUrl || "");
    };

    const apply = () => {
      const next: FlokEvent = {
        ...ev,
        title: form.title.trim() || "Begivenhed",
        cover: form.cover,
        description: form.description,
        address: form.address,
        datetime: new Date(form.datetime).toISOString(),
        endtime: new Date(form.endtime).toISOString(),
        timezone: form.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        isPublic: !!form.isPublic,
        hasPassword: !!form.hasPassword && !!form.password,
        password: form.hasPassword ? form.password : "",
        cohosts: form.cohosts || [],
        allowGuestPosts: !!form.allowGuestPosts,
        notifyOnHostPost: !!form.notifyOnHostPost,
        maxGuests: form.maxGuests === "" ? undefined : Number(form.maxGuests),
        waitlist: !!form.waitlist,
        autoPromote: !!form.autoPromote,
        rsvpPolicy: (() : FlokEvent['rsvpPolicy'] => {
          const t = form.rsvpPolicy;
          if (t === "none" || t === "max") return { type: t };
          if ((t === "deadline" || t === "both") && form.deadline)
            return { type: t, deadline: new Date(form.deadline).toISOString() };
          return { type: "none" };
        })(),
      };
      if (next.hasPassword) {
        try { localStorage.removeItem(`flok:entered:${ev.id}`); } catch {}
      }
      if (applySeries && ev.seriesId) {
        const updated = { ...db, events: { ...db.events } } as any;
        for (const eId of Object.keys(updated.events)) {
          const item = updated.events[eId];
          if (item.seriesId === ev.seriesId) {
            updated.events[eId] = {
              ...item,
              title: next.title,
              cover: next.cover,
              description: next.description,
              address: next.address,
              timezone: next.timezone,
              isPublic: next.isPublic,
              hasPassword: next.hasPassword,
              password: next.password,
              cohosts: next.cohosts,
              allowGuestPosts: next.allowGuestPosts,
              notifyOnHostPost: next.notifyOnHostPost,
              maxGuests: next.maxGuests,
              waitlist: next.waitlist,
              autoPromote: next.autoPromote,
              rsvpPolicy: next.rsvpPolicy,
            };
          }
        }
        save(updated);
      } else {
        onSave(next);
      }
      toast("Indstillinger gemt", 'success');
    };

    const duplicate = () => {
      const id = uid();
      const now = nowIso();
      const clone = {
        ...ev,
        id,
        title: `${ev.title} (kopi)`,
        attendees: {},
        waitlistQueue: [],
        posts: [],
        inviteToken: generateInviteToken(db),
        createdAt: now,
        archivedAt: null,
      };
      const nextDb = { ...db, events: { ...db.events, [id]: clone } };
      save(nextDb);
      setRoute({ name: "event", id });
    };

    const removeEvent = async () => {
      {
        const ok = await askConfirm({ title: 'Slet begivenhed', message: 'Dette kan ikke fortrydes. Vil du fortsætte?', confirmText: 'Slet', cancelText: 'Annullér' });
        if (!ok) return;
      }
      const nextDb: any = { ...db, events: { ...db.events } };
      const removed = nextDb.events[ev.id];
      delete nextDb.events[ev.id];
      save(nextDb);
      toastAction('Begivenhed slettet', 'Fortryd', () => {
        const restored = { ...db, events: { ...db.events, [removed.id]: removed } } as any;
        save(restored);
        setRoute({ name: 'event', id: removed.id });
      });
      setRoute({ name: "home" });
    };

    const toggleArchive = () => {
      const isArchived = !!ev.archivedAt;
      const next = { ...ev, archivedAt: isArchived ? null : nowIso() };
      onSave(next);
    };

    return (
      <div className={`${card} p-4 space-y-4`}>
        <h3 className="text-lg font-semibold">Værtstyring</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Titel</label>
            <input className={`${card} px-3 py-2 bg-transparent`} value={form.title} aria-label="Titel" placeholder="Titel" onChange={(e) => update("title", e.target.value)} />
            <label className="text-sm font-medium">Beskrivelse</label>
            <textarea className={`${card} px-3 py-2 bg-transparent h-28`} value={form.description} onChange={(e) => update("description", e.target.value)} />
            <label className="text-sm font-medium">Adresse</label>
            <input className={`${card} px-3 py-2 bg-transparent`} value={form.address} aria-label="Adresse" placeholder="Adresse" onChange={(e) => update("address", e.target.value)} />
            <label className="text-sm font-medium">Start</label>
            <input type="datetime-local" className={`${card} px-3 py-2 bg-transparent`} value={form.datetime} aria-label="Startdato og -tid" onChange={(e) => update("datetime", e.target.value)} />
            <label className="text-sm font-medium">Slut</label>
            <input type="datetime-local" className={`${card} px-3 py-2 bg-transparent`} value={form.endtime} aria-label="Slutdato og -tid" onChange={(e) => update("endtime", e.target.value)} />
            <label className="text-sm font-medium">Timezone</label>
            <input className={`${card} px-3 py-2 bg-transparent`} value={form.timezone} aria-label="Tidszone" onChange={(e) => update("timezone", e.target.value)} placeholder="Europe/Copenhagen" />
            <div className="space-y-1">
              <div className="text-sm font-medium">Medværter</div>
              <div className="flex flex-wrap gap-2">
                {form.cohosts.map((id) => (
                  <span key={id} className={`${chip} inline-flex items-center gap-2`}>
                    {db.users[id]?.name || 'Ukendt'}
                    <button className={btn} aria-label="Fjern medvært" onClick={()=> update('cohosts', form.cohosts.filter((x)=> x!==id))}><X size={14} /></button>
                  </span>
                ))}
              </div>
              <CohostPicker users={db.users} exclude={[ev.hostId, ...form.cohosts]} onPick={(id)=> update('cohosts', [...form.cohosts, id])} />
            </div>
          </div>
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="text-sm font-medium">Forsidebillede</div>
              {form.cover && <img src={form.cover} className="w-full h-28 object-cover rounded-xl ring-1 ring-black/5" />}
              <input type="file" accept="image/*" onChange={(e) => onPickCover(e.target.files?.[0])} />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm">Offentlig</label>
              <input type="checkbox" checked={form.isPublic} onChange={(e) => update("isPublic", e.target.checked)} />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm">Adgangskode</label>
              <input type="checkbox" checked={form.hasPassword} onChange={(e) => update("hasPassword", e.target.checked)} />
            </div>
            {form.hasPassword && (
              <div className="space-y-1">
                <input className={`${card} px-3 py-2 bg-transparent`} placeholder="Sæt adgangskode" aria-label="Adgangskode" value={form.password} onChange={(e) => update("password", e.target.value)} />
                <div className="text-xs text-amber-600 dark:text-amber-400">Gæster skal indtaste den nye kode igen efter ændring.</div>
              </div>
            )}
            <div className="flex items-center justify-between">
              <label className="text-sm">Gæsteopslag tilladt</label>
              <input type="checkbox" checked={form.allowGuestPosts} onChange={(e) => update("allowGuestPosts", e.target.checked)} />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm">Notifikation ved værtsopslag</label>
              <input type="checkbox" checked={form.notifyOnHostPost} onChange={(e) => update("notifyOnHostPost", e.target.checked)} />
            </div>

            <div className="space-y-1">
              <div className="text-sm font-medium">Invitationskode</div>
              <div className="flex items-center flex-wrap gap-2">
                <span className={chip}>{ev.inviteToken || '—'}</span>
                <button className={btn} onClick={() => { if (!ev.inviteToken) return; navigator.clipboard.writeText(ev.inviteToken); toast('Kopiéret', 'success'); haptic('light'); }}>
                  <Copy size={16} /> Kopiér
                </button>
                <button className={btn} onClick={async () => {
                  const ok = await askConfirm({ title: 'Ny invitationskode', message: 'Den gamle vil ikke virke længere. Fortsæt?', confirmText: 'Generér', cancelText: 'Annullér' });
                  if (!ok) return;
                  const prev = ev.inviteToken;
                  const code = generateInviteToken(db);
                  const next = { ...ev, inviteToken: code };
                  onSave(next);
                  toastAction('Ny invitationskode oprettet', 'Fortryd', () => onSave({ ...next, inviteToken: prev }));
                }}>
                  <RefreshCw size={16} /> Ny kode
                </button>
              </div>
              <div className="text-xs text-zinc-600 dark:text-zinc-300">Gæster kan indtaste koden under “Deltag med kode”.</div>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm w-40">Maks gæster</label>
              <input className={`${card} px-3 py-2 bg-transparent flex-1`} inputMode="numeric" aria-label="Maks antal gæster" value={form.maxGuests} onChange={(e) => update("maxGuests", e.target.value.replace(/[^0-9]/g, ""))} placeholder="Tom for uendelig" />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm">Venteliste</label>
              <input type="checkbox" checked={form.waitlist} onChange={(e) => update("waitlist", e.target.checked)} />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm">Auto-promover fra venteliste</label>
              <input type="checkbox" checked={form.autoPromote} onChange={(e) => update("autoPromote", e.target.checked)} />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-medium">Svarregler</div>
              <select className={`${card} px-3 py-2 bg-transparent w-full`} value={form.rsvpPolicy} onChange={(e) => update("rsvpPolicy", e.target.value as ManageFormState['rsvpPolicy'])}>
                <option value="none">Ingen begrænsning</option>
                <option value="deadline">Deadline</option>
                <option value="max">Kun maks. antal</option>
                <option value="both">Deadline og maks.</option>
              </select>
              {(form.rsvpPolicy === "deadline" || form.rsvpPolicy === "both") && (
                <input type="datetime-local" className={`${card} px-3 py-2 bg-transparent w-full`} value={form.deadline} aria-label="Svarfrist" onChange={(e) => update("deadline", e.target.value)} />
              )}
            </div>
            {ev.seriesId && (
              <label className="text-sm inline-flex items-center gap-2">
                <input type="checkbox" checked={applySeries} onChange={(e)=> setApplySeries(e.target.checked)} />
                Opdater hele serien ({ev.seriesIndex || '?'} / {ev.seriesTotal || '?'})
              </label>
            )}
          </div>
        </div>
        <div className="flex flex-wrap justify-between gap-2">
          <div className="flex gap-2">
            <button className={btn} onClick={duplicate}><Plus size={18} /> Duplikér</button>
            <button className={btn} onClick={toggleArchive}>{ev.archivedAt ? 'Fjern arkiv' : 'Arkivér'}</button>
            <button className={btn} onClick={removeEvent}><X size={18} /> Slet</button>
          </div>
          <button className={btnPrimary} onClick={apply}><Check size={18} /> Gem</button>
        </div>
      </div>
    );
  };

  const Welcome: React.FC<{ me: FlokUser | null }> = ({ me }) => {
    return (
      <div className={`${card} p-4 flex items-center justify-between`}>
        <div>
          <div className="text-xl font-semibold flex items-center gap-2">
            <Logo />
            Velkommen {me ? me.name : "gæst"}
          </div>
          <div className="text-sm text-zinc-600 dark:text-zinc-300">
            Opret, del og svar på invitationer. Simpelt for alle aldre.
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2" />
      </div>
    );
  };

  const Friends: React.FC = () => {
    const [q, setQ] = useState<string>("");
    const [suggested, setSuggested] = useState<string[]>([]);
    const users = Object.values(db.users) as FlokUser[];
    const term = q.trim().toLowerCase();
    const results: FlokUser[] = term
      ? users.filter(
          (u) =>
            u.id !== me?.id &&
            ((u.name || "").toLowerCase().includes(term) ||
              (u.email || "").toLowerCase().includes(term) ||
              (u.phone || "").toLowerCase().includes(term))
        )
      : [];
    const addFriend = (id: string) => befriend(id);
    const importContacts = async () => {
      try {
        const nav: any = navigator as any;
        if (!nav?.contacts?.select) {
          toast('Kontaktimport kræver en kompatibel browser', 'error');
          return;
        }
        const picked = await nav.contacts.select(['name', 'email', 'tel'], { multiple: true });
        const norm = (s: string) => (s || '').replace(/\s|-/g, '').toLowerCase();
        const phones = new Set<string>();
        const emails = new Set<string>();
        for (const p of picked || []) {
          for (const t of (p.tel || [])) phones.add(norm(t));
          for (const e of (p.email || [])) emails.add(norm(e));
        }
        const matches = users
          .filter((u) => u.id !== me?.id)
          .filter((u) => (u.phone && phones.has(norm(u.phone))) || (u.email && emails.has(norm(u.email))))
          .map((u) => u.id);
        setSuggested(matches);
        toast(`${matches.length} i dine kontakter har en Flok‑profil`, 'success');
      } catch {
        toast('Kunne ikke importere kontakter', 'error');
      }
    };
    return (
      <div className="space-y-4">
        {me && (me.friendRequestsIncoming || []).length > 0 && (
          <div className={`${card} p-4 space-y-2`}>
            <div className="font-semibold">Venneanmodninger</div>
            <div className="space-y-2">
              {(me.friendRequestsIncoming || []).map((fromId) => {
                const u = db.users[fromId];
                if (!u) return null;
                return (
                  <div key={fromId} className="flex items-center justify-between">
                    <button className="font-medium hover:underline text-left" onClick={() => setRoute({ name: 'profile', id: fromId })}>{u.name}</button>
                    <div className="flex gap-2">
                      <button className={btn} onClick={() => acceptFriendRequest(fromId)}><Check size={16} /> Acceptér</button>
                      <button className={btn} onClick={() => declineFriendRequest(fromId)}><X size={16} /> Afvis</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div className={`${card} p-4 flex items-center gap-2`}>
          <Search size={18} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Søg via navn, e‑mail eller telefon"
            className="bg-transparent outline-none flex-1"
          />
          <button className={btn} onClick={importContacts} title="Importér fra dine kontakter (eksperimentel)">Importér kontakter</button>
        </div>
        {suggested.length > 0 && (
          <div className={`${card} p-4 space-y-2`}>
            <div className="font-semibold">Foreslået fra dine kontakter</div>
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {suggested.map((id) => {
                const u = db.users[id];
                if (!u) return null;
                const st = me ? friendStatus(me.id, u.id) : 'none';
                return (
                  <div key={u.id} className={`${card} p-4 flex items-center justify-between`}>
                    <div className="min-w-0">
                      <button className="font-medium hover:underline text-left block truncate" onClick={() => setRoute({ name: 'profile', id: u.id })}>{u.name}</button>
                      <div className="text-xs text-zinc-500 truncate">{u.email} · {u.phone}</div>
                    </div>
                    <div className="flex gap-2">
                      {st === 'friends' ? (
                        <button className={btn} onClick={() => { if (confirm('Fjerne som ven?')) unfriend(u.id); }}>Fjern ven</button>
                      ) : st === 'outgoing' ? (
                        <button className={btn} disabled><Hourglass size={16} /> Anmodet</button>
                      ) : st === 'incoming' ? (
                        <button className={btn} onClick={() => acceptFriendRequest(u.id)}><Check size={16} /> Acceptér</button>
                      ) : (
                        <button className={btn} onClick={() => addFriend(u.id)}><UserPlus size={16} /> Tilføj ven</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {!term && (
          <div className={`${card} p-4 text-sm text-zinc-700 dark:text-zinc-300`}>
            Søg efter venner via navn, e‑mail eller telefon — eller importér dine kontakter for at finde eksisterende profiler.
          </div>
        )}
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {results.map((u) => (
            <div key={u.id} className={`${card} p-4 flex items-center justify-between`}>
              <div className="min-w-0">
                <button className="font-medium hover:underline text-left block truncate" onClick={() => setRoute({ name: 'profile', id: u.id })}>{u.name}</button>
                <div className="text-xs text-zinc-500 truncate">{u.email} · {u.phone}</div>
              </div>
              <div className="flex gap-2">
                <button className={btn} onClick={() => setRoute({ name: 'profile', id: u.id })}>Se profil</button>
                {(() => {
                  const st = me ? friendStatus(me.id, u.id) : 'none';
                  if (st === 'friends') return <button className={btn} onClick={() => { if (confirm('Fjerne som ven?')) unfriend(u.id); }}>Fjern ven</button>;
                  if (st === 'outgoing') return <button className={btn} disabled><Hourglass size={16} /> Anmodet</button>;
                  if (st === 'incoming') return <button className={btn} onClick={() => acceptFriendRequest(u.id)}><Check size={16} /> Acceptér</button>;
                  return <button className={btn} onClick={() => addFriend(u.id)}><UserPlus size={16} /> Tilføj ven</button>;
                })()}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const CohostPicker: React.FC<{
    users: Record<string, FlokUser>;
    exclude?: string[];
    onPick: (id: string) => void;
  }> = ({ users, exclude = [], onPick }) => {
    const [q, setQ] = useState<string>("");
    const list = Object.values(users)
      .filter(
        (u) =>
          !exclude.includes(u.id) &&
          (u.name.toLowerCase().includes(q.toLowerCase()) ||
            u.email.toLowerCase().includes(q.toLowerCase()))
      )
      .slice(0, 6);
    return (
      <div className={`${card} p-2`}> 
        <div className="flex items-center gap-2">
          <Search size={16} />
          <input className="bg-transparent outline-none flex-1" placeholder="Søg medværter" aria-label="Søg medværter" value={q} onChange={(e)=> setQ(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          {list.map((u)=> (
            <button key={u.id} className={btn} onClick={()=> onPick(u.id)}><UserPlus size={14} /> {u.name}</button>
          ))}
          {list.length===0 && <div className="text-xs text-zinc-500">Ingen resultater</div>}
        </div>
      </div>
    );
  };

  const Notifications: React.FC = () => {
    const mine = currentActorId();
    const all = db.notifications.slice().sort((a, b) => +new Date(b.at) - +new Date(a.at));
    const list = all.filter((n) => n.owner === mine);
    const high = list.filter((n) => n.importance === 'high');
    const low = list.filter((n) => n.importance !== 'high');
    const myUserId = me?.id;
    const eventById = (id: string) => db.events[id];
    const myInvites: FlokInvite[] = myUserId ? db.invites.filter((iv) => iv.to === myUserId && iv.status === 'pending') : [];
    const markAll = () => {
      const targetOwner = mine;
      save((prev: FlokDB) => ({
        ...prev,
        notifications: prev.notifications.map((n) =>
          n.owner === targetOwner ? { ...n, read: true } : n
        ),
      }));
    };
    const clearAll = async () => {
      if (
        !(await askConfirm({
          title: 'Ryd notifikationer',
          message: 'Vil du slette alle dine notifikationer?',
          confirmText: 'Ryd',
          cancelText: 'Annullér',
        }))
      )
        return;
      const targetOwner = mine;
      const prevMine = list;
      save((prev: FlokDB) => ({
        ...prev,
        notifications: prev.notifications.filter((n) => n.owner !== targetOwner),
      }));
      toastAction('Notifikationer ryddet', 'Fortryd', () => {
        save((prev: FlokDB) => ({
          ...prev,
          notifications: [...prev.notifications, ...prevMine],
        }));
      });
    };
    const Section: React.FC<{ title: string; items: NotificationItem[] }> = ({ title, items }) => (
      <div className="space-y-2">
        <div className="text-sm font-medium px-1">{title}</div>
        {items.length === 0 && <div className={`${card} p-3 text-sm`}>Ingen</div>}
        {items.map((n) => (
          <div key={n.id} className={`${card} p-3 flex items-center justify-between`}> 
            <div>
              <div className="text-sm">{n.text}</div>
                <div className="text-xs text-zinc-600 dark:text-zinc-300">{new Date(n.at).toLocaleString()}</div>
            </div>
            {!n.read && <span className={`${chip}`}>Ny</span>}
          </div>
        ))}
      </div>
    );
    return (
      <div className="space-y-4">
        <div className={`${card} p-4 flex items-center justify-between`}>
          <div className="font-semibold">Notifikationer</div>
          <div className="flex gap-2">
            <button className={btn} onClick={() => askNotify()}>Tilladelser</button>
            <button className={btn} onClick={markAll}>Markér som læst</button>
            <button className={btn} onClick={clearAll}>Ryd</button>
          </div>
        </div>
        {myInvites.length > 0 && (
          <div className={`${card} p-4 space-y-2`}>
            <div className="text-sm font-medium">Invitationer</div>
            <div className="space-y-2">
              {myInvites.map((iv)=> (
                <div key={iv.id} className={`${card} p-3 flex items-center justify-between`}>
                  <div>
                    <div className="text-sm">{`Invitation: ${eventById(iv.eventId)?.title || 'Begivenhed'}`}</div>
                    <div className="text-xs text-zinc-600 dark:text-zinc-300">{new Date(iv.at).toLocaleString()}</div>
                  </div>
                  <div className="flex gap-2">
                    <button className={btn} onClick={() => setRoute({ name: 'event', id: iv.eventId })}>Åbn</button>
                    <button className={btnPrimary} onClick={() => { acceptInvite(iv.id); setRoute({ name: 'event', id: iv.eventId }); }}>Acceptér</button>
                    <button className={btn} onClick={() => declineInvite(iv.id)}>Afslå</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {list.length === 0 && myInvites.length === 0 && <div className={`${card} p-4 text-sm`}>Ingen notifikationer endnu</div>}
        {list.length > 0 && (
          <div className="space-y-4">
            <Section title="Vigtige" items={high} />
            <Section title="Andre" items={low} />
          </div>
        )}
      </div>
    );
  };

  const NewEvent: React.FC = () => {
    if (!me) {
      return (
        <div className={`${card} p-6 max-w-md mx-auto space-y-3`}>
          <div className="text-lg font-semibold">Log ind for at oprette</div>
          <div className="text-sm text-zinc-700 dark:text-zinc-300">Kun brugere med konto kan oprette begivenheder.</div>
          <div className="flex gap-2">
            <button className={btn} onClick={() => setRoute({ name: 'auth' })}><LogIn size={18} /> Log ind</button>
            <button className={btn} onClick={() => setRoute({ name: 'explore' })}><Search size={18} /> Udforsk</button>
          </div>
        </div>
      );
    }
    const [f, setF] = useState<EventFormState>({
      title: "",
      description: "",
      address: "",
      datetime: new Date(Date.now() + 864e5).toISOString().slice(0, 16),
      endtime: new Date(Date.now() + 864e5 + 2 * 60 * 60 * 1000).toISOString().slice(0, 16),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Copenhagen",
      isPublic: false,
      password: "",
      allowGuestPosts: true,
      notifyOnHostPost: true,
      maxGuests: "",
      waitlist: false,
      autoPromote: false,
      rsvpPolicy: "none",
      deadline: "",
      cover: "",
      repeat: "none",
      repeatCount: "1",
    });
    const upd = <K extends keyof EventFormState>(key: K, value: EventFormState[K]) =>
      setF((x) => ({ ...x, [key]: value }));

    const onPick = async (file?: File) => {
      if (!file) return;
      const res = await compressImage(file, 1800, 0.85);
      upd("cover", (res as { dataUrl?: string } | undefined)?.dataUrl || "");
    };

    const submit = () => {
      const title = (f.title || "").trim();
      if (!title) { toast("Skriv en titel", 'error'); haptic('medium'); return; }
      let start = new Date(f.datetime);
      let end = new Date(f.endtime);
      if (!(start instanceof Date) || isNaN(+start)) start = new Date(Date.now() + 864e5);
      if (!(end instanceof Date) || isNaN(+end) || +end <= +start) end = new Date(+start + 2 * 60 * 60 * 1000);
      const base = {
        title,
        cover: f.cover,
        description: f.description,
        address: f.address,
        datetime: start.toISOString(),
        endtime: end.toISOString(),
        timezone: f.timezone,
        isPublic: f.isPublic,
        password: f.password,
        allowGuestPosts: f.allowGuestPosts,
        notifyOnHostPost: f.notifyOnHostPost,
        maxGuests: f.maxGuests === "" ? undefined : Number(f.maxGuests),
        waitlist: f.waitlist,
        autoPromote: f.autoPromote,
        rsvpPolicy:
          f.rsvpPolicy === "none" || f.rsvpPolicy === "max"
            ? { type: f.rsvpPolicy }
            : f.deadline
            ? { type: f.rsvpPolicy, deadline: new Date(f.deadline).toISOString() }
            : { type: "none" },
      };
      const count = Math.max(1, parseInt(f.repeatCount || '1', 10));
      const seriesId = count > 1 ? uid() : undefined;
      const ids = [] as string[];
      for (let i=0;i<count;i++) {
        const s = new Date(start);
        const e = new Date(end);
        if (i>0) {
          if (f.repeat === 'weekly') { s.setDate(s.getDate() + 7*i); e.setDate(e.getDate() + 7*i); }
          if (f.repeat === 'monthly') { s.setMonth(s.getMonth() + i); e.setMonth(e.getMonth() + i); }
        }
        const res = createEvent({ ...base, datetime: s.toISOString(), endtime: e.toISOString(), seriesId, seriesIndex: i+1, seriesTotal: count });
        ids.push(res?.id || '');
      }
      if (ids[0]) setRoute({ name: 'event', id: ids[0] });
    };

    return (
      <div className={`${card} p-4 space-y-4`}>
        <h3 className="text-lg font-semibold">Opret begivenhed</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <input className={`${card} px-3 py-2 bg-transparent`} placeholder="Titel" aria-label="Titel" value={f.title} onChange={(e) => upd("title", e.target.value)} />
            <textarea className={`${card} px-3 py-2 bg-transparent h-28`} placeholder="Beskrivelse" value={f.description} onChange={(e) => upd("description", e.target.value)} />
            <input className={`${card} px-3 py-2 bg-transparent`} placeholder="Adresse" aria-label="Adresse" value={f.address} onChange={(e) => upd("address", e.target.value)} />
            <label className="text-sm">Start</label>
            <input type="datetime-local" className={`${card} px-3 py-2 bg-transparent`} value={f.datetime} aria-label="Startdato og -tid" onChange={(e) => upd("datetime", e.target.value)} />
            <label className="text-sm">Slut</label>
            <input type="datetime-local" className={`${card} px-3 py-2 bg-transparent`} value={f.endtime} aria-label="Slutdato og -tid" onChange={(e) => upd("endtime", e.target.value)} />
            <input className={`${card} px-3 py-2 bg-transparent`} placeholder="Timezone (fx Europe/Copenhagen)" aria-label="Tidszone" value={f.timezone} onChange={(e) => upd("timezone", e.target.value)} />
            <div className="space-y-1">
              <div className="text-sm font-medium">Gentagelser</div>
              <div className="flex items-center gap-2">
                <select className={`${card} px-3 py-2 bg-transparent`} value={f.repeat} onChange={(e)=> upd('repeat', e.target.value as EventFormState['repeat'])}>
                  <option value="none">Ingen</option>
                  <option value="weekly">Ugentligt</option>
                  <option value="monthly">Månedligt</option>
                </select>
                <input className={`${card} px-3 py-2 bg-transparent w-24`} inputMode="numeric" aria-label="Antal gentagelser" value={f.repeatCount} onChange={(e)=> upd('repeatCount', e.target.value.replace(/[^0-9]/g, ''))} placeholder="Antal" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm">Offentlig</label>
              <input type="checkbox" checked={f.isPublic} onChange={(e) => upd("isPublic", e.target.checked)} />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm">Adgangskode</label>
              <input type="checkbox" checked={!!f.password} onChange={(e) => upd("password", f.password ? "" : "kode")} />
            </div>
            {!!f.password && (
              <input className={`${card} px-3 py-2 bg-transparent`} placeholder="Sæt adgangskode" aria-label="Adgangskode" value={f.password} onChange={(e) => upd("password", e.target.value)} />
            )}
          </div>
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="text-sm font-medium">Forsidebillede</div>
              {f.cover && <img src={f.cover} className="w-full h-28 object-cover rounded-xl ring-1 ring-black/5" />}
              <input type="file" accept="image/*" onChange={(e) => onPick(e.target.files?.[0])} />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm">Gæsteopslag tilladt</label>
              <input type="checkbox" checked={f.allowGuestPosts} onChange={(e) => upd("allowGuestPosts", e.target.checked)} />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm">Notifikation ved værtsopslag</label>
              <input type="checkbox" checked={f.notifyOnHostPost} onChange={(e) => upd("notifyOnHostPost", e.target.checked)} />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm w-40">Maks gæster</label>
              <input className={`${card} px-3 py-2 bg-transparent flex-1`} inputMode="numeric" aria-label="Maks antal gæster" value={f.maxGuests} onChange={(e) => upd("maxGuests", e.target.value.replace(/[^0-9]/g, ""))} placeholder="Tom for uendelig" />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm">Venteliste</label>
              <input type="checkbox" checked={f.waitlist} onChange={(e) => upd("waitlist", e.target.checked)} />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-medium">Svarregler</div>
              <select className={`${card} px-3 py-2 bg-transparent w-full`} value={f.rsvpPolicy} onChange={(e) => upd("rsvpPolicy", e.target.value as EventFormState['rsvpPolicy'])}>
                <option value="none">Ingen begrænsning</option>
                <option value="deadline">Deadline</option>
                <option value="max">Kun maks. antal</option>
                <option value="both">Deadline og maks.</option>
              </select>
              {(f.rsvpPolicy === "deadline" || f.rsvpPolicy === "both") && (
                <input type="datetime-local" className={`${card} px-3 py-2 bg-transparent w-full`} value={f.deadline} aria-label="Svarfrist" onChange={(e) => upd("deadline", e.target.value)} />
              )}
            </div>
          </div>
        </div>
        <div className="flex justify-center">
          <button className={btnPrimary} onClick={submit}><Plus size={18} /> Opret</button>
        </div>
      </div>
    );
  };

  const Profile: React.FC<{ id: string }> = ({ id }) => {
    const u = db.users[id];
    if (!u) return <div className={`${card} p-6`}>Bruger ikke fundet</div>;
    const mine = me?.id === u.id;
    const [edit, setEdit] = useState(false);
    const isTempOwner = (() => {
      const t = db.sessions[sessionId]?.temp;
      if (!t) return false;
      const rec = db.events[t.eventId]?.tempAccounts?.[t.username];
      return rec?.userId === u.id;
    })();
    const needsConversion = !u.email || !u.phone || !u.name;
    const [conv, setConv] = useState({ name: u.name || '', email: u.email || '', phone: u.phone || '' });
    const [socials, setSocials] = useState(() => ({
      website: u.socials?.website || '',
      instagram: u.socials?.instagram || '',
      facebook: u.socials?.facebook || '',
      x: u.socials?.x || '',
      tiktok: u.socials?.tiktok || '',
    }));
    const saveSocials = () => {
      if (!mine) return;
      const me2 = { ...u, socials: { ...socials } };
      const next = { ...db, users: { ...db.users, [u.id]: me2 } };
      save(next);
      setEdit(false);
    };
    const eventsByUser = (Object.values(db.events) as FlokEvent[])
      .filter((event) => (event.hostId === u.id || (event.cohosts || []).includes(u.id)) && (event.isPublic || visibleToUser(event)) && !event.archivedAt)
      .sort((a, b) => +new Date(a.datetime) - +new Date(b.datetime));
    const st = me ? friendStatus(me.id, u.id) : 'none';
    const commonFriends = (() => {
      if (!me) return 0;
      const a = new Set(me.friends || []);
      return (u.friends || []).filter((x: string) => a.has(x)).length;
    })();
    return (
      <div className="space-y-4">
        <button className={btn} onClick={() => setRoute({ name: 'home' })}><ArrowLeft size={18} /> Tilbage</button>
        <div className={`${card} p-6 space-y-3`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-semibold">{u.name}</div>
              <div className="text-sm text-zinc-700 dark:text-zinc-300">{u.email} · {u.phone}{me && !mine ? ` · ${commonFriends} fælles venner` : ''}</div>
            </div>
            <div className="flex gap-2">
              {!mine && u.phone && (
                <a className={btn} href={`tel:${u.phone}`}><Phone size={18} /> Ring</a>
              )}
              {!mine && me && me.id !== u.id && db.users[u.id] && (
                st === 'friends' ? (
                  <button className={btn} onClick={() => { if (confirm('Fjerne som ven?')) unfriend(u.id); }}>Fjern ven</button>
                ) : st === 'outgoing' ? (
                  <button className={btn} disabled><Hourglass size={18} /> Anmodet</button>
                ) : st === 'incoming' ? (
                  <button className={btn} onClick={() => acceptFriendRequest(u.id)}><Check size={18} /> Acceptér</button>
                ) : (
                  <button className={btn} onClick={() => befriend(u.id)}><UserPlus size={18} /> Tilføj ven</button>
                )
              )}
              {mine && (
                <button className={btn} onClick={() => setEdit((v)=>!v)}>{edit ? 'Luk' : 'Redigér'}</button>
              )}
            </div>
          </div>
          <div>
            <div className="font-semibold">Sociale medier</div>
            {mine && edit ? (
              <div className="grid sm:grid-cols-2 gap-2 pt-2">
                <input className={`${card} px-3 py-2 bg-transparent`} placeholder="Website (https://...)" aria-label="Website" value={socials.website} onChange={(e)=> setSocials({...socials, website: e.target.value})} />
                <input className={`${card} px-3 py-2 bg-transparent`} placeholder="Instagram (https://...)" aria-label="Instagram" value={socials.instagram} onChange={(e)=> setSocials({...socials, instagram: e.target.value})} />
                <input className={`${card} px-3 py-2 bg-transparent`} placeholder="Facebook (https://...)" aria-label="Facebook" value={socials.facebook} onChange={(e)=> setSocials({...socials, facebook: e.target.value})} />
                <input className={`${card} px-3 py-2 bg-transparent`} placeholder="X/Twitter (https://...)" aria-label="X/Twitter" value={socials.x} onChange={(e)=> setSocials({...socials, x: e.target.value})} />
                <input className={`${card} px-3 py-2 bg-transparent`} placeholder="TikTok (https://...)" aria-label="TikTok" value={socials.tiktok} onChange={(e)=> setSocials({...socials, tiktok: e.target.value})} />
                <div className="sm:col-span-2">
                  <button className={btnPrimary} onClick={saveSocials}><Check size={18} /> Gem</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 pt-2">
                {u.socials?.website && <a className={btn} href={u.socials.website} target="_blank" rel="noreferrer"><Globe2 size={18} /> Website</a>}
                {u.socials?.instagram && <a className={btn} href={u.socials.instagram} target="_blank" rel="noreferrer"><AtSign size={18} /> Instagram</a>}
                {u.socials?.facebook && <a className={btn} href={u.socials.facebook} target="_blank" rel="noreferrer"><AtSign size={18} /> Facebook</a>}
                {u.socials?.x && <a className={btn} href={u.socials.x} target="_blank" rel="noreferrer"><AtSign size={18} /> X</a>}
                {u.socials?.tiktok && <a className={btn} href={u.socials.tiktok} target="_blank" rel="noreferrer"><AtSign size={18} /> TikTok</a>}
                {!u.socials || Object.values(u.socials).filter(Boolean).length === 0 ? (
                  <div className="text-sm text-zinc-700 dark:text-zinc-300">{mine ? 'Tilføj dine sociale links' : 'Ingen sociale links'}</div>
                ) : null}
              </div>
            )}
          </div>
        </div>
        {mine && (
          <div className={`${card} p-4 space-y-3`}>
            <div className="flex items-center justify-between">
              <div className="font-semibold">Børn</div>
              <label className="text-sm inline-flex items-center gap-2">
                <input type="checkbox" checked={!!u.isParent} onChange={(e)=> {
                  const updated = { ...u, isParent: e.target.checked };
                  const next = { ...db, users: { ...db.users, [u.id]: updated } };
                  save(next);
                }} />
                Forælder
              </label>
            </div>
            {u.isParent ? (
              <KidsEditor user={u} />
            ) : (
              <div className="text-sm text-zinc-700 dark:text-zinc-300">Slå "Forælder" til for at tilføje børn, som du kan inkludere i svar.</div>
            )}
          </div>
        )}

        <div className={`${card} p-4 space-y-2`}>
          {(isTempOwner && needsConversion) && (
            <div className="space-y-2">
              <div className="font-semibold">Gør til fast konto</div>
              <div className="text-sm text-zinc-700 dark:text-zinc-300">Udfyld dine oplysninger for at gemme en permanent konto. Kræver navn, e-mail og telefon.</div>
            <input className={`${card} px-3 py-2 bg-transparent w-full`} placeholder="Navn" aria-label="Navn" value={conv.name} onChange={(e)=> setConv((c)=> ({...c, name: e.target.value}))} />
            <input className={`${card} px-3 py-2 bg-transparent w-full`} placeholder="E-mail" aria-label="E-mail" value={conv.email} onChange={(e)=> setConv((c)=> ({...c, email: e.target.value}))} />
            <input className={`${card} px-3 py-2 bg-transparent w-full`} placeholder="Telefon" aria-label="Telefon" value={conv.phone} onChange={(e)=> setConv((c)=> ({...c, phone: e.target.value}))} />
              <button className={btnPrimary} onClick={() => { const res = convertToPermanentAccount(u.id, conv.name, conv.email, conv.phone); if (!res.ok) { toast(res.error || 'Kunne ikke opgradere', 'error'); haptic('medium'); } else { toast('Din konto er opgraderet', 'success'); haptic('light'); } }}><Check size={18} aria-hidden /> Gem som konto</button>
            </div>
          )}
        </div>
        <div className={`${card} p-4 space-y-2`}>
          <div className="font-semibold">Begivenheder ({eventsByUser.length})</div>
          {eventsByUser.length === 0 && <div className="text-sm">Ingen synlige begivenheder</div>}
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {eventsByUser.map((ev) => (
              <EventCard key={ev.id} ev={ev} onOpen={() => goEvent(ev.id)} />
            ))}
          </div>
        </div>
      </div>
    );
  };

  const KidsEditor: React.FC<{ user: FlokUser }> = ({ user }) => {
    const [name, setName] = useState<string>("");
    const [age, setAge] = useState<string>("");
    const add = () => {
      const nm = (name||'').trim();
      const ag = parseInt((age||'').replace(/[^0-9]/g, ''), 10);
      if (!nm || isNaN(ag)) { toast('Udfyld navn og alder', 'error'); haptic('medium'); return; }
      const updated = { ...user, children: [...(user.children||[]), { id: uid(), name: nm, age: ag }] };
      const next = { ...db, users: { ...db.users, [user.id]: updated } };
      save(next);
      setName(""); setAge("");
    };
    const remove = (cid: string) => {
      const updated = { ...user, children: (user.children||[]).filter((c) => c.id !== cid) };
      const next = { ...db, users: { ...db.users, [user.id]: updated } };
      save(next);
    };
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {(user.children||[]).length === 0 && <div className="text-sm">Ingen børn tilføjet endnu</div>}
          {(user.children||[]).map((c) => (
            <span key={c.id} className={`${chip} inline-flex items-center gap-2`}>
              {c.name} {typeof c.age==='number' ? `(${c.age})` : ''}
              <button className={btn} onClick={() => remove(c.id)}><X size={14} aria-hidden /> Fjern</button>
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input className={`${card} px-3 py-2 bg-transparent`} placeholder="Barnets navn" aria-label="Barnets navn" value={name} onChange={(e)=> setName(e.target.value)} />
          <input className={`${card} px-3 py-2 bg-transparent w-28`} placeholder="Alder" aria-label="Alder" inputMode="numeric" value={age} onChange={(e)=> setAge(e.target.value)} />
          <button className={btnPrimary} onClick={add}><UserPlus size={16} aria-hidden /> Tilføj</button>
        </div>
        <div className="text-xs text-zinc-600 dark:text-zinc-300">Når du svarer på en begivenhed, kan du vælge hvilke børn der deltager.</div>
      </div>
    );
  };

  const Auth = () => {
    const [mode, setMode] = useState("login");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");

    const doLogin = () => {
      const res = login(email.trim() || undefined, password, phone.trim() || undefined);
    if (!res.ok) toast(res.error || 'Kunne ikke oprette bruger', 'error');
      else setRoute({ name: "home" });
    };
    const doRegister = () => {
      const res = register(name.trim(), email.trim(), phone.trim());
    if (!res.ok) toast(res.error || 'Kunne ikke logge ind', 'error');
      else setRoute({ name: "home" });
    };

    return (
      <div className={`${card} p-6 max-w-md mx-auto space-y-4`}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{mode === "login" ? "Log ind" : "Opret konto"}</h3>
          <button className={btn} onClick={() => setMode(mode === "login" ? "register" : "login")}>
            {mode === "login" ? "Opret" : "Log ind"}
          </button>
        </div>
        {mode === "register" && (
          <>
            <input className={`${card} px-3 py-2 bg-transparent w-full`} placeholder="Navn" aria-label="Navn" value={name} onChange={(e) => setName(e.target.value)} />
            <input className={`${card} px-3 py-2 bg-transparent w-full`} placeholder="E-mail" aria-label="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className={`${card} px-3 py-2 bg-transparent w-full`} placeholder="Telefon" aria-label="Telefon" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <button className={btnPrimary} onClick={doRegister}><UserPlus size={18} /> Opret</button>
          </>
        )}
        {mode === "login" && (
          <>
            <input className={`${card} px-3 py-2 bg-transparent w-full`} placeholder="E-mail (eller tom)" aria-label="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className={`${card} px-3 py-2 bg-transparent w-full`} placeholder="Telefon (eller tom)" aria-label="Telefon" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <input className={`${card} px-3 py-2 bg-transparent w-full`} type="password" placeholder="Kodeord" aria-label="Kodeord" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button className={btnPrimary} onClick={doLogin}><LogIn size={18} /> Log ind</button>
          </>
        )}
      </div>
    );
  };

  const Logo = () => {
    return (
      <div className="inline-flex items-center gap-2 select-none">
        <svg width="24" height="24" viewBox="0 0 48 48" aria-hidden>
          <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="16" cy="18" r="5" fill="#0ea5e9" stroke="none"/>
            <circle cx="32" cy="30" r="5" fill="#10b981" stroke="none"/>
            <circle cx="36" cy="14" r="4" fill="#ec4899" stroke="none"/>
            <path d="M20 20 L28 26" stroke="#94a3b8"/>
            <path d="M34 18 L33 25" stroke="#94a3b8"/>
          </g>
        </svg>
        <span className="font-semibold tracking-tight">Flok</span>
      </div>
    );
  };

  // Deltag via kode (event-id eller invitekode)
  const JoinButton = () => {
    const [open, setOpen] = useState(false);
    const [val, setVal] = useState("");
    const doJoin = () => {
      const code = (val || "").trim();
      if (!code) { toast('Angiv en kode', 'error'); haptic('medium'); return; }
      // Direkte event-id
      if ((db.events || {})[code]) { setRoute({ name: 'event', id: code }); setOpen(false); return; }
      // Link der indeholder event-id (hash eller query)
      try {
        let shareId: string | undefined;
        const hashMatch = /#event:([A-Za-z0-9_-]+)/i.exec(code);
        if (hashMatch?.[1]) shareId = hashMatch[1];
        if (!shareId && /https?:/i.test(code)) {
          const url = new URL(code);
          const hash = /#event:([A-Za-z0-9_-]+)/i.exec(url.hash || '');
          if (hash?.[1]) shareId = hash[1];
          if (!shareId) {
            const queryId = url.searchParams.get('event');
            if (queryId) shareId = queryId;
          }
        }
        if (!shareId) {
          const queryFallback = /[?&]event=([A-Za-z0-9_-]+)/i.exec(code);
          if (queryFallback?.[1]) shareId = queryFallback[1];
        }
        if (shareId && (db.events || {})[shareId]) {
          setRoute({ name: 'event', id: shareId });
          setOpen(false);
          return;
        }
      } catch {}
      // Invitekode (inviteToken)
      const byInvite = (Object.values(db.events) as FlokEvent[]).find((e) => e.inviteToken === code);
      if (byInvite) { setRoute({ name: 'event', id: byInvite.id }); setOpen(false); return; }
      toast('Ingen begivenhed fundet for koden', 'error');
      haptic('medium');
    };
    return (
      <>
        <button className={btn} onClick={() => setOpen(true)} title="Deltag med kode">
          <LogIn size={18} aria-hidden />
          <span className="hidden sm:inline">Deltag med kode</span>
        </button>
        {open && (
          <div className="fixed inset-0 z-[200] bg-black/30 flex items-center justify-center p-4" role="dialog" aria-modal>
            <FocusTrap onEsc={() => setOpen(false)}>
              <div className={`${card} max-w-md w-full p-4 sm:p-6 space-y-3`}>
              <div className="text-lg font-semibold">Deltag via kode</div>
                <input className={`${card} px-3 py-2 bg-transparent w-full`} placeholder="Indtast event-ID, invitationskode eller link" value={val} onChange={(e)=> setVal(e.target.value)} />
                <div className="text-xs text-zinc-600 dark:text-zinc-300">Tip: Få koden fra værten eller brug linket fra invitationen.</div>
                <div className="flex justify-end gap-2">
                  <button className={btn} onClick={() => setOpen(false)}>Luk</button>
                  <button className={btnPrimary} onClick={doJoin}><LogIn size={16} aria-hidden /> Gå til</button>
                </div>
              </div>
            </FocusTrap>
          </div>
        )}
      </>
    );
  };

  // Root render
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <div className="max-w-6xl mx-auto p-3 sm:p-6 space-y-4 pb-20">
        <Toolbar />
        {((route.name === "home" && !!me) || route.name === "explore" || route.name === "friends") && <Nav />}
        {route.name === "home" && <Home />}
        {route.name === "explore" && <Explore />}
        {route.name === "friends" && <Friends />}
        {route.name === "new" && <NewEvent />}
        {route.name === "auth" && <Auth />}
        {route.name === "notifs" && <Notifications />}
        {route.name === "event" && <EventPage id={route.id} />}
        {route.name === "profile" && <Profile id={route.id || (me?.id || '')} />}
      </div>
      {((route.name === "home" && !!me) || route.name === "explore" || route.name === "friends") && <BottomNav />}
    </div>
  );

}
