/** Local-time date helpers. Days are 'YYYY-MM-DD' strings in the device's time zone. */
const pad = (n: number) => String(n).padStart(2, '0')

export function ymd(d: Date | number = new Date()): string {
  const x = typeof d === 'number' ? new Date(d) : d
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`
}

export function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y!, (m || 1) - 1, d || 1)
}

export function addDays(s: string, n: number): string {
  const d = parseYmd(s)
  d.setDate(d.getDate() + n)
  return ymd(d)
}

export function weekdayOf(s: string): number {
  return parseYmd(s).getDay()
}

export function startOfWeek(s: string, weekStart = 1): string {
  const diff = (weekdayOf(s) - weekStart + 7) % 7
  return addDays(s, -diff)
}

export function startOfMonth(s: string): string {
  return s.slice(0, 8) + '01'
}

export function endOfMonth(s: string): string {
  const d = parseYmd(startOfMonth(s))
  d.setMonth(d.getMonth() + 1)
  d.setDate(0)
  return ymd(d)
}

export function addMonths(s: string, n: number): string {
  const d = parseYmd(s)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + n)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, last))
  return ymd(d)
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseYmd(b).getTime() - parseYmd(a).getTime()) / 86400000)
}

export function rangeDays(from: string, to: string): string[] {
  const out: string[] = []
  let cur = from
  let guard = 0
  while (cur <= to && guard++ < 400) {
    out.push(cur)
    cur = addDays(cur, 1)
  }
  return out
}

/** timestamp of 'HH:mm' on a given day */
export function atTime(day: string, time: string): number {
  const d = parseYmd(day)
  const [h, m] = time.split(':').map(Number)
  d.setHours(h || 0, m || 0, 0, 0)
  return d.getTime()
}

export function hhmm(ts: number): string {
  const d = new Date(ts)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Is `ts` inside the quiet window (which may cross midnight)? */
export function inQuietHours(ts: number, from: string, to: string): boolean {
  const cur = hhmm(ts)
  if (from === to) return false
  return from < to ? (cur >= from && cur < to) : (cur >= from || cur < to)
}

export function clock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`
}
