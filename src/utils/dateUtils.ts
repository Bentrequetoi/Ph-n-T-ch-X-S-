import { DayOfWeek } from '../types';

export const VIETNAMESE_DAYS: DayOfWeek[] = [
  'Chủ nhật',
  'Thứ 2',
  'Thứ 3',
  'Thứ 4',
  'Thứ 5',
  'Thứ 6',
  'Thứ 7',
];

/**
 * Calculates Vietnamese Day of Week from a Date or ISO string "YYYY-MM-DD"
 */
export function getVietnameseDayOfWeek(dateInput: string | Date): DayOfWeek {
  let d: Date;
  if (typeof dateInput === 'string') {
    // Check if format is DD/MM/YYYY
    if (dateInput.includes('/')) {
      const parts = dateInput.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        d = new Date(year, month, day);
      } else {
        d = new Date(dateInput);
      }
    } else {
      // e.g. YYYY-MM-DD
      const [year, month, day] = dateInput.split('-').map(Number);
      d = new Date(year, month - 1, day);
    }
  } else {
    d = dateInput;
  }

  const dayIndex = d.getDay(); // 0 = Sunday, 1 = Monday, etc.
  return VIETNAMESE_DAYS[dayIndex] || 'Thứ 2';
}

/**
 * Parses user date string (DD/MM/YYYY or YYYY-MM-DD or DD-MM-YYYY)
 * Returns { iso: "YYYY-MM-DD", display: "DD/MM/YYYY", valid: boolean }
 */
export function parseDateString(raw: string): {
  iso: string;
  display: string;
  dayOfWeek: DayOfWeek;
  valid: boolean;
} {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { iso: '', display: '', dayOfWeek: 'Thứ 2', valid: false };
  }

  // Case 1: DD/MM/YYYY or DD-MM-YYYY
  const slashOrDashMatch = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (slashOrDashMatch) {
    const day = parseInt(slashOrDashMatch[1], 10);
    const month = parseInt(slashOrDashMatch[2], 10);
    const year = parseInt(slashOrDashMatch[3], 10);

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const d = new Date(year, month - 1, day);
      if (!isNaN(d.getTime())) {
        const padDay = String(day).padStart(2, '0');
        const padMonth = String(month).padStart(2, '0');
        const iso = `${year}-${padMonth}-${padDay}`;
        const display = `${padDay}/${padMonth}/${year}`;
        const dow = getVietnameseDayOfWeek(d);
        return { iso, display, dayOfWeek: dow, valid: true };
      }
    }
  }

  // Case 2: YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const d = new Date(year, month - 1, day);
      if (!isNaN(d.getTime())) {
        const padDay = String(day).padStart(2, '0');
        const padMonth = String(month).padStart(2, '0');
        const iso = `${year}-${padMonth}-${padDay}`;
        const display = `${padDay}/${padMonth}/${year}`;
        const dow = getVietnameseDayOfWeek(d);
        return { iso, display, dayOfWeek: dow, valid: true };
      }
    }
  }

  return { iso: '', display: '', dayOfWeek: 'Thứ 2', valid: false };
}

/**
 * Computes difference in whole days between two ISO date strings (date2 - date1)
 */
export function getDayDifference(dateIso1: string, dateIso2: string): number {
  const d1 = new Date(dateIso1);
  const d2 = new Date(dateIso2);
  const diffTime = d2.getTime() - d1.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Returns ISO date string (YYYY-MM-DD) of the Monday for the week containing the given date.
 * Groups records into weeks for cross-date and schedule validation.
 */
export function getWeekStartMonday(dateIso: string): string {
  const parts = dateIso.split('-');
  if (parts.length < 3) return dateIso;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  const d = new Date(year, month - 1, day);
  if (isNaN(d.getTime())) return dateIso;
  const dayOfWeek = d.getDay(); // 0 is Sunday, 1 is Monday...
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  d.setDate(d.getDate() + diffToMonday);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
