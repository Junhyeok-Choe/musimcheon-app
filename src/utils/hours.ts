import { HoursConfidence, Restaurant } from '@/types';

export type PlaceAvailabilityStatus =
  | 'open'
  | 'closed'
  | 'break_time'
  | 'holiday'
  | 'unknown';

export interface PlaceAvailability {
  status: PlaceAvailabilityStatus;
  confidence: HoursConfidence;
  summary: string;
}

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
const DAY_ALIASES: Record<number, string[]> = {
  0: ['일', '일요일', 'sunday'],
  1: ['월', '월요일', 'monday'],
  2: ['화', '화요일', 'tuesday'],
  3: ['수', '수요일', 'wednesday'],
  4: ['목', '목요일', 'thursday'],
  5: ['금', '금요일', 'friday'],
  6: ['토', '토요일', 'saturday'],
};

function parseTimeToMinutes(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const match = value.trim().match(/(\d{1,2})[:시]\s*(\d{1,2})?/);
  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2] ?? '0');

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return null;
  }

  return hour * 60 + minute;
}

function parseRange(value: string | null | undefined): [number, number] | null {
  if (!value) {
    return null;
  }

  const match = value.match(/(\d{1,2}[:시]\s*\d{0,2})\s*[-~]\s*(\d{1,2}[:시]\s*\d{0,2})/);
  if (!match) {
    return null;
  }

  const start = parseTimeToMinutes(match[1]);
  const end = parseTimeToMinutes(match[2]);

  if (start === null || end === null) {
    return null;
  }

  return [start, end];
}

function overlaps(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && startB < endA;
}

export function formatMinutes(minutes: number): string {
  const safe = ((minutes % 1440) + 1440) % 1440;
  const hour = Math.floor(safe / 60);
  const minute = safe % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function normalizeRequestedTime(value: string | null | undefined, fallbackDate = new Date()): string {
  const parsed = parseTimeToMinutes(value ?? '');
  if (parsed === null) {
    return formatMinutes(fallbackDate.getHours() * 60 + fallbackDate.getMinutes());
  }
  return formatMinutes(parsed);
}

export function getPlaceAvailability(
  place: Restaurant,
  visitStartMinutes: number,
  dwellMinutes: number,
  referenceDate = new Date()
): PlaceAvailability {
  const closeMinutes = parseTimeToMinutes(place.closeTime);
  const openMinutes = parseTimeToMinutes(place.openTime);
  const breakRange = parseRange(place.breakTime);
  const visitEnd = visitStartMinutes + dwellMinutes;
  const weekday = referenceDate.getDay();
  const holidayText = place.holiday?.toLowerCase() ?? '';
  const holidayMatches = DAY_ALIASES[weekday].some((alias) => holidayText.includes(alias));

  if (!place.openTime && !place.closeTime && !place.breakTime && !place.holiday) {
    return {
      status: 'unknown',
      confidence: 'low',
      summary: '영업시간 미확인',
    };
  }

  if (holidayMatches) {
    return {
      status: 'holiday',
      confidence: place.hoursConfidence ?? 'low',
      summary: `${DAY_NAMES[weekday]}요일 휴무 정보`,
    };
  }

  if (openMinutes !== null && closeMinutes !== null) {
    const effectiveClose = closeMinutes < openMinutes ? closeMinutes + 1440 : closeMinutes;
    const effectiveStart = visitStartMinutes < openMinutes ? visitStartMinutes + 1440 : visitStartMinutes;
    const effectiveEnd = visitEnd < openMinutes ? visitEnd + 1440 : visitEnd;

    if (effectiveStart < openMinutes || effectiveEnd > effectiveClose) {
      return {
        status: 'closed',
        confidence: place.hoursConfidence ?? 'low',
        summary: `영업시간 ${place.openTime}-${place.closeTime} 밖`,
      };
    }
  }

  if (breakRange) {
    const [breakStart, breakEnd] = breakRange;
    if (overlaps(visitStartMinutes, visitEnd, breakStart, breakEnd)) {
      return {
        status: 'break_time',
        confidence: place.hoursConfidence ?? 'low',
        summary: `브레이크타임 ${place.breakTime}`,
      };
    }
  }

  return {
    status: 'open',
    confidence: place.hoursConfidence ?? 'high',
    summary: place.operatingScheduleSummary || '영업 가능',
  };
}
