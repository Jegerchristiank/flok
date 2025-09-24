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

export const buildInviteUrl = (ev: { id?: string | number } | null | undefined): string => {
  const id = ev?.id != null ? String(ev.id) : '';
  if (!id) return '';
  try {
    const loc = (globalThis as any)?.location;
    const origin = loc?.origin || '';
    return origin ? `${origin}/#event:${id}` : `#event:${id}`;
  } catch {
    return `#event:${id}`;
  }
};
