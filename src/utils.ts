// Utils extracted for reuse and testing
export const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
export const nowIso = () => new Date().toISOString();

export const fmtDateTime = (iso: string, tz?: string) => {
  try {
    const dt = new Date(iso);
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: tz || undefined,
    }).format(dt);
  } catch {
    return iso;
  }
};

export const fmtDateTimeRange = (startIso: string, endIso?: string, tz?: string) => {
  try {
    const start = new Date(startIso);
    const end = endIso ? new Date(endIso) : null;
    const optsDate: any = { dateStyle: 'medium' };
    const optsTime: any = { timeStyle: 'short' };
    const z = tz || undefined;
    if (!end) {
      return `${new Intl.DateTimeFormat(undefined, { ...optsDate, ...optsTime, timeZone: z }).format(start)}`;
    }
    const sameDay = start.toDateString() === end.toDateString();
    if (sameDay) {
      const d = new Intl.DateTimeFormat(undefined, { ...optsDate, timeZone: z }).format(start);
      const t1 = new Intl.DateTimeFormat(undefined, { ...optsTime, timeZone: z }).format(start);
      const t2 = new Intl.DateTimeFormat(undefined, { ...optsTime, timeZone: z }).format(end);
      return `${d} kl. ${t1}–${t2}`;
    }
    const s = new Intl.DateTimeFormat(undefined, { ...optsDate, ...optsTime, timeZone: z }).format(start);
    const e = new Intl.DateTimeFormat(undefined, { ...optsDate, ...optsTime, timeZone: z }).format(end);
    return `${s} – ${e}`;
  } catch {
    return startIso;
  }
};

export const escapeICS = (s: string) => String(s).replace(/[\\;,\n]/g, (m) => ({ "\\": "\\\\", ";": "\\;", ",": "\\,", "\n": "\\n" } as any)[m]);

// Safer Base64 (URL-safe) helpers without deprecated escape/unescape
const base64Encode = (bytes: Uint8Array): string => {
  // Prefer btoa if available (browser/jsdom), else Buffer in Node
  try {
    const chunk = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    if (typeof btoa === 'function') return btoa(binary);
    // @ts-ignore Buffer may exist in Node
    return Buffer.from(bytes).toString('base64');
  } catch {
    // @ts-ignore Buffer may exist in Node
    return Buffer.from(bytes).toString('base64');
  }
};

const base64Decode = (b64: string): Uint8Array => {
  try {
    if (typeof atob === 'function') {
      const bin = atob(b64);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
    // @ts-ignore Buffer may exist in Node
    return new Uint8Array(Buffer.from(b64, 'base64'));
  } catch {
    // @ts-ignore Buffer may exist in Node
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }
};

const toUrlSafe = (b64: string) => b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromUrlSafe = (s: string) => {
  const norm = (s || '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = norm.length % 4 ? 4 - (norm.length % 4) : 0;
  return norm + (pad ? '='.repeat(pad) : '');
};

export const base64UrlEncode = (text: string): string => {
  const enc = new TextEncoder();
  const bytes = enc.encode(text);
  return toUrlSafe(base64Encode(bytes));
};

export const base64UrlDecode = (b64url: string): string => {
  try {
    const b64 = fromUrlSafe(b64url);
    const bytes = base64Decode(b64);
    const dec = new TextDecoder();
    return dec.decode(bytes);
  } catch {
    return '';
  }
};

export const toGoogleCalLink = (ev: any) => {
  const start = new Date(ev.datetime);
  const end = ev.endtime ? new Date(ev.endtime) : new Date(new Date(ev.datetime).getTime() + 2 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  const toZ = (d: Date) =>
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(
      d.getUTCHours()
    )}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  const dates = `${toZ(start)}/${toZ(end)}`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.title || 'Begivenhed',
    details: ev.description || '',
    location: ev.address || '',
    dates,
    ctz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Copenhagen',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

export const toICS = (ev: any) => {
  const dt = new Date(ev.datetime);
  const end = ev.endtime ? new Date(ev.endtime) : new Date(dt.getTime() + 2 * 60 * 60 * 1000);
  const toICSDate = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
      d.getUTCFullYear() +
      pad(d.getUTCMonth() + 1) +
      pad(d.getUTCDate()) +
      'T' +
      pad(d.getUTCHours()) +
      pad(d.getUTCMinutes()) +
      pad(d.getUTCSeconds()) +
      'Z'
    );
  };
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Flok//DA',
    'BEGIN:VEVENT',
    `UID:${ev.id || uid()}@flok.local`,
    `DTSTAMP:${toICSDate(new Date())}`,
    `DTSTART:${toICSDate(dt)}`,
    `DTEND:${toICSDate(end)}`,
    `SUMMARY:${escapeICS(ev.title || 'Begivenhed')}`,
    `DESCRIPTION:${escapeICS(ev.description || '')}`,
    `LOCATION:${escapeICS(ev.address || '')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n');
};

// Portable invite snapshots for demo (works without a real backend)
export const encodeSnapshot = (ev: any) => {
  try {
    const snap = {
      id: ev.id,
      title: ev.title,
      description: ev.description,
      address: ev.address,
      datetime: ev.datetime,
      endtime: ev.endtime,
      timezone: ev.timezone,
      isPublic: !!ev.isPublic,
      cover: ev.cover || '',
    };
    const json = JSON.stringify(snap);
    // Prefer compressed encoding for shorter links; fallback to base64url
    try {
      const z = compressToEncodedURIComponent(json);
      if (z && z.length > 0) return z;
    } catch {}
    return base64UrlEncode(json);
  } catch {
    return '';
  }
};
export const decodeSnapshot = (code: string) => {
  // Back-compat: try base64url first, then LZ compressed variant
  try {
    const json = base64UrlDecode(code);
    if (json && json.trim().startsWith('{')) return JSON.parse(json);
  } catch {}
  try {
    const json2 = decompressFromEncodedURIComponent(code) || '';
    if (json2 && json2.trim().startsWith('{')) return JSON.parse(json2);
  } catch {}
  return null as any;
};

import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
export const shortInviteUrl = (ev: any) => {
  try {
    const origin = typeof location !== 'undefined' ? location.origin : '';
    const snap = encodeSnapshot(ev);
    return origin ? `${origin}/#s:${snap}` : `#s:${snap}`;
  } catch {
    return '';
  }
};
