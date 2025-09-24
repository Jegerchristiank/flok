import { describe, it, expect } from 'vitest';
import { toICS, fmtDateTimeRange, buildInviteUrl } from './utils';

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

  it('builds invite url with event id', () => {
    const url = buildInviteUrl(sample);
    expect(url).toContain('#event:');
    expect(url.endsWith('#event:e1')).toBe(true);
  });
});
