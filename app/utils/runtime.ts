import { reactive } from 'vue'

/** Tiny app-wide reactive state shared by the scheduler, focus timer and notifications. */
export const runtime = reactive({
  /** today's local date; refreshed by the scheduler so screens roll over at midnight */
  today: ymd(),
  /** bumps roughly every 15 s */
  now: Date.now(),
  /** a focus countdown is running: hold non-reminder alerts */
  focusing: false,
  /** splash + first DB load finished */
  booted: false
})
