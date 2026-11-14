const KM_DAYS = ['អាទិត្យ', 'ច័ន្ទ', 'អង្គារ', 'ពុធ', 'ព្រហស្បតិ៍', 'សុក្រ', 'សៅរ៍']
const KM_DAYS_NARROW = ['អា', 'ច', 'អ', 'ពុ', 'ព្រ', 'សុ', 'ស']
const KM_MONTHS = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ']
const KM_DIGITS = '០១២៣៤៥៦៧៨៩'
export const kmDigits = (n: number | string) => String(n).replace(/\d/g, c => KM_DIGITS[Number(c)]!)

/** Locale-aware formatting (Khmer first). */
export function useFmt() {
  const { locale, t } = useI18n()
  const tag = computed(() => (locale.value === 'km' ? 'km-KH' : 'en-US'))

  /**
   * Khmer dates are formatted with built-in name tables: many browsers and phones ship
   * without Khmer locale data for Intl and would print things like "M11 14, Sat".
   * English keeps Intl.
   */
  function date(day: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }) {
    const d = parseYmd(day)
    if (locale.value !== 'km') return new Intl.DateTimeFormat(tag.value, opts).format(d)
    const parts: string[] = []
    if (opts.weekday === 'narrow') parts.push(KM_DAYS_NARROW[d.getDay()]!)
    else if (opts.weekday === 'long') parts.push(`ថ្ងៃ${KM_DAYS[d.getDay()]}`)
    else if (opts.weekday) parts.push(KM_DAYS[d.getDay()]!)
    if (opts.day) parts.push(kmDigits(d.getDate()))
    if (opts.month) parts.push(KM_MONTHS[d.getMonth()]!)
    if (opts.year) parts.push(kmDigits(d.getFullYear()))
    return parts.join(' ')
  }
  const longDate = (day: string) => date(day, { weekday: 'long', month: 'short', day: 'numeric' })
  const shortDate = (day: string) => date(day, { month: 'short', day: 'numeric' })
  const weekdayShort = (day: string) => date(day, { weekday: 'short' })
  const weekdayNarrow = (day: string) => date(day, { weekday: 'narrow' })
  const monthYear = (day: string) => date(day, { month: 'long', year: 'numeric' })

  function time(ts: number | string) {
    const d = typeof ts === 'string' ? new Date(atTime(ymd(), ts)) : new Date(ts)
    // Khmer: plain 24-hour clock (no dependency on Intl locale data)
    if (locale.value === 'km') return hhmm(d.getTime())
    return new Intl.DateTimeFormat(tag.value, { hour: 'numeric', minute: '2-digit' }).format(d)
  }

  /** 95 → "1h 35m" / "1 ម៉ោង 35 នាទី" */
  function duration(min: number) {
    const m = Math.max(0, Math.round(min))
    const h = Math.floor(m / 60)
    const r = m % 60
    if (h && r) return `${t('dur.h', { n: h })} ${t('dur.m', { n: r })}`
    if (h) return t('dur.h', { n: h })
    return t('dur.m', { n: r })
  }

  function relativeDay(day: string) {
    if (day === runtime.today) return t('common.today')
    if (day === addDays(runtime.today, 1)) return t('common.tomorrow')
    if (day === addDays(runtime.today, -1)) return t('common.yesterday')
    return date(day)
  }

  const boxName = (box: number) => t(`box.${box}`)
  const boxLabel = (box: number) => t(`box.${box}`)

  function repeatLabel(r: { type: string, days: number[] }) {
    if (r.type === 'daily') return t('repeat.daily')
    if (r.type === 'weekdays') return t('repeat.weekdays')
    if (r.type === 'days') {
      // 2023-01-01 was a Sunday
      return r.days.slice().sort().map(d => weekdayShort(addDays('2023-01-01', d))).join(' ')
    }
    return t('repeat.never')
  }

  return { date, longDate, shortDate, weekdayShort, weekdayNarrow, monthYear, time, duration, relativeDay, boxName, boxLabel, repeatLabel, tag }
}
