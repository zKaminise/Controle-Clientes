export const APP_TIMEZONE = 'America/Sao_Paulo';
export const DEFAULT_DOMAIN_THRESHOLDS = [60, 30, 15, 7, 3, 0] as const;

type DateParts = { year: number; month: number; day: number };

function datePartsInTimeZone(date: Date, timeZone: string): DateParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

function timeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  const representedAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );
  return representedAsUtc - Math.floor(date.getTime() / 1000) * 1000;
}

export function localDateStartUtc(dateValue: string, timeZone = APP_TIMEZONE) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  if (!match) throw new Error('Data inválida. Use YYYY-MM-DD.');
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const utcWallClock = Date.UTC(year, month - 1, day);
  let candidate = new Date(utcWallClock);
  candidate = new Date(utcWallClock - timeZoneOffsetMs(candidate, timeZone));
  candidate = new Date(utcWallClock - timeZoneOffsetMs(candidate, timeZone));
  return candidate;
}

export function addCalendarDays(dateValue: string, days: number) {
  const [year, month, day] = dateValue.split('-').map(Number);
  if (!year || !month || !day) throw new Error('Data inválida.');
  const result = new Date(Date.UTC(year, month - 1, day + days));
  return result.toISOString().slice(0, 10);
}

export function zonedDayRange(now = new Date(), timeZone = APP_TIMEZONE) {
  const parts = datePartsInTimeZone(now, timeZone);
  const date = `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
  return {
    date,
    start: localDateStartUtc(date, timeZone),
    end: localDateStartUtc(addCalendarDays(date, 1), timeZone),
  };
}

export function zonedDateRange(
  from: string,
  to: string,
  timeZone = APP_TIMEZONE,
) {
  if (from > to) throw new Error('A data inicial deve ser anterior à final.');
  return {
    from,
    to,
    start: localDateStartUtc(from, timeZone),
    end: localDateStartUtc(addCalendarDays(to, 1), timeZone),
    timeZone,
  };
}

export type SubscriptionFrequency =
  | 'monthly'
  | 'quarterly'
  | 'semiannual'
  | 'annual'
  | 'custom';

export function billingMonths(
  frequency: SubscriptionFrequency,
  customIntervalMonths?: number | null,
) {
  const map: Record<Exclude<SubscriptionFrequency, 'custom'>, number> = {
    monthly: 1,
    quarterly: 3,
    semiannual: 6,
    annual: 12,
  };
  if (frequency === 'custom') {
    if (!customIntervalMonths || customIntervalMonths < 1)
      throw new Error('Intervalo personalizado inválido.');
    return customIntervalMonths;
  }
  return map[frequency];
}

export function daysInMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

export function addMonthsClamped(
  dateValue: string,
  months: number,
  preferredDay?: number,
) {
  const [year, month, day] = dateValue.split('-').map(Number);
  if (!year || !month || !day) throw new Error('Data inválida.');
  const absoluteMonth = year * 12 + (month - 1) + months;
  const nextYear = Math.floor(absoluteMonth / 12);
  const nextMonthIndex = absoluteMonth % 12;
  const targetDay = Math.min(
    preferredDay ?? day,
    daysInMonth(nextYear, nextMonthIndex),
  );
  return `${String(nextYear).padStart(4, '0')}-${String(nextMonthIndex + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
}

export function nextSubscriptionDate(input: {
  currentDate: string;
  frequency: SubscriptionFrequency;
  billingDay: number;
  customIntervalMonths?: number | null;
}) {
  return addMonthsClamped(
    input.currentDate,
    billingMonths(input.frequency, input.customIntervalMonths),
    input.billingDay,
  );
}

export function billingPeriod(dateValue: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue))
    throw new Error('Data de cobrança inválida.');
  return dateValue.slice(0, 7);
}

export function subscriptionDatesThroughHorizon(input: {
  nextChargeDate: string;
  horizon: string;
  frequency: SubscriptionFrequency;
  billingDay: number;
  customIntervalMonths?: number | null;
  endDate?: string | null;
}) {
  const dates: string[] = [];
  let nextDate = input.nextChargeDate;
  let guard = 0;
  while (
    nextDate <= input.horizon &&
    (!input.endDate || nextDate <= input.endDate) &&
    guard < 240
  ) {
    dates.push(nextDate);
    nextDate = nextSubscriptionDate({
      currentDate: nextDate,
      frequency: input.frequency,
      billingDay: input.billingDay,
      customIntervalMonths: input.customIntervalMonths,
    });
    guard += 1;
  }
  return { dates, nextDate };
}

export function initialChargeStatus(
  dueDate: string,
  today: string,
): 'scheduled' | 'pending' {
  return dueDate <= today ? 'pending' : 'scheduled';
}

export function shouldMarkOverdue(
  dueDate: string,
  today: string,
  status: string,
) {
  return status === 'pending' && dueDate < today;
}

export function domainTaskKey(
  domainId: string,
  expirationDate: string,
  threshold: number,
) {
  return `domain:${domainId}:${expirationDate}:${threshold}`;
}

export function isoDateInTimeZone(now = new Date(), timeZone = APP_TIMEZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

export function dateAtNoon(dateValue: string) {
  return new Date(`${dateValue}T12:00:00-03:00`);
}

export function differenceInCalendarDays(left: string, right: string) {
  const leftTime = Date.parse(`${left}T12:00:00Z`);
  const rightTime = Date.parse(`${right}T12:00:00Z`);
  return Math.round((leftTime - rightTime) / 86_400_000);
}

export function crossedDomainThresholds(
  expirationDate: string,
  today: string,
  thresholds: readonly number[],
) {
  const days = differenceInCalendarDays(expirationDate, today);
  return thresholds.filter((threshold) => days <= threshold);
}

export function nextPostSaleDate(
  lastContactDate: string,
  frequencyMonths: number,
) {
  if (frequencyMonths < 1) throw new Error('Frequência de contato inválida.');
  return addMonthsClamped(lastContactDate, frequencyMonths);
}

export function normalizeBrazilianPhone(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13))
    return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  throw new Error('Informe um telefone brasileiro com DDD.');
}

export function whatsappUrl(phone: string, message: string) {
  return `https://wa.me/${normalizeBrazilianPhone(phone)}?text=${encodeURIComponent(message)}`;
}

export function moneyToMinorUnits(value: string | number) {
  const normalized = (() => {
    if (typeof value === 'number') return value.toFixed(2);
    const trimmed = value.trim();
    if (trimmed.includes(','))
      return trimmed.replace(/\./g, '').replace(',', '.');
    return trimmed;
  })();
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized))
    throw new Error('Valor monetário inválido.');
  return Math.round(Number(normalized) * 100);
}

export function minorUnitsToMoney(value: number) {
  return (value / 100).toFixed(2);
}

export function paymentAmountForBalance(input: {
  chargeAmount: string | number;
  alreadyPaid: string | number;
  requestedAmount?: string | number;
}) {
  const charge = moneyToMinorUnits(input.chargeAmount);
  const paid = moneyToMinorUnits(input.alreadyPaid);
  const remaining = charge - paid;
  if (remaining <= 0) throw new Error('A cobrança já está quitada.');
  const requested =
    input.requestedAmount === undefined
      ? remaining
      : moneyToMinorUnits(input.requestedAmount);
  if (requested <= 0 || requested > remaining) {
    throw new Error(
      'O pagamento deve ser maior que zero e não pode exceder o saldo.',
    );
  }
  return minorUnitsToMoney(requested);
}

export function pipelineTransition(input: {
  isWon: boolean;
  isLost: boolean;
  now?: Date;
  lostReason?: string | null;
}) {
  const now = input.now ?? new Date();
  return {
    wonAt: input.isWon ? now : null,
    lostAt: input.isLost ? now : null,
    lostReason: input.isLost ? input.lostReason || null : null,
    companyLifecycle: input.isWon ? ('client' as const) : null,
  };
}

export function proposalStatusTimestamps(input: {
  status?: string;
  now?: Date;
  existing?: {
    sentAt?: Date | null;
    acceptedAt?: Date | null;
    rejectedAt?: Date | null;
  };
}) {
  const now = input.now ?? new Date();
  const wasSent = input.existing?.sentAt;
  const wasAccepted = input.existing?.acceptedAt;
  const wasRejected = input.existing?.rejectedAt;
  const sentStatuses = ['sent', 'negotiation', 'accepted', 'rejected'];

  return {
    ...(input.status && sentStatuses.includes(input.status) && !wasSent
      ? { sentAt: now }
      : {}),
    ...(input.status === 'accepted' && !wasAccepted ? { acceptedAt: now } : {}),
    ...(input.status === 'rejected' && !wasRejected ? { rejectedAt: now } : {}),
  };
}
