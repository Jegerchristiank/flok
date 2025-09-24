import { describe, it, expect } from 'vitest';
import { encodeSnapshot, decodeSnapshot, toICS, fmtDateTimeRange, shortInviteUrl } from './utils';

describe('utils', () => {
  const sample = {
    id: 'e1',
    title: 'Test',
    description: 'D',
    address: 'Somewhere 1',
    datetime: new Date('2025-01-01T10:00:00Z').toISOString(),
    endtime: new Date('2025-01-01T12:00:00Z').toISOString(),
    timezone: 'Europe/Copenhagen',
    isPublic: true,
    cover: '',
  } as any;

  it('encodes and decodes snapshot', () => {
    const s = encodeSnapshot(sample);
    expect(typeof s).toBe('string');
    const decoded = decodeSnapshot(s);
    expect(decoded.title).toBe(sample.title);
    expect(decoded.address).toBe(sample.address);
  });

  it('handles unicode safely in snapshot', () => {
    const u = { ...sample, title: 'ÆØÅ – Café “Smørrebrød” 🍰' } as any;
    const enc = encodeSnapshot(u);
    const dec = decodeSnapshot(enc);
    expect(dec.title).toBe(u.title);
  });

  it('creates valid ICS content', () => {
    const ics = toICS(sample);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('SUMMARY:Test');
  });

  it('formats date ranges', () => {
    const s = fmtDateTimeRange(sample.datetime, sample.endtime, 'UTC');
    expect(typeof s).toBe('string');
  });

  it('creates short link from snapshot', () => {
    // window.location mocked by jsdom in Vitest
    const url = shortInviteUrl(sample);
    expect(url).toContain('#s:');
  });
});
