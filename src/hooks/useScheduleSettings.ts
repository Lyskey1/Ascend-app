const LS_KEYS = {
  programStart: 'iron_program_start',
  restDay: 'iron_rest_day',
  vacations: 'iron_vacations',
};

export interface VacationPeriod {
  id: string;
  start: string; // yyyy-MM-dd
  end: string;   // yyyy-MM-dd
  note?: string;
}

export function getProgramStartDate(): string | null {
  return localStorage.getItem(LS_KEYS.programStart) || null;
}

export function setProgramStartDate(date: string | null) {
  if (date) {
    localStorage.setItem(LS_KEYS.programStart, date);
  } else {
    localStorage.removeItem(LS_KEYS.programStart);
  }
}

export function getRestDay(): string {
  return localStorage.getItem(LS_KEYS.restDay) ?? 'Sunday';
}

export function setRestDaySetting(day: string) {
  localStorage.setItem(LS_KEYS.restDay, day);
}

export function getVacationPeriods(): VacationPeriod[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEYS.vacations) ?? '[]');
  } catch {
    return [];
  }
}

export function setVacationPeriods(periods: VacationPeriod[]) {
  localStorage.setItem(LS_KEYS.vacations, JSON.stringify(periods));
}

export function isDateInVacation(dateStr: string, periods: VacationPeriod[]): boolean {
  return periods.some((p) => dateStr >= p.start && dateStr <= p.end);
}
