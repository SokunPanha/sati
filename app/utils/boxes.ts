import type { Box } from '~/types'

export interface BoxStyle { bg: string, tx: string, solid: string, soft: string }

/** Box colours (CSS variables, so they follow light / dark mode). */
export const BOX_STYLES: Record<Box, BoxStyle> = {
  1: { bg: 'var(--color-b1-bg)', tx: 'var(--color-b1-tx)', solid: 'var(--color-b1)', soft: 'var(--color-b1-soft)' },
  2: { bg: 'var(--color-brand-tint)', tx: 'var(--color-brand-dark)', solid: 'var(--color-brand)', soft: 'var(--color-b2-soft)' },
  3: { bg: 'var(--color-b3-bg)', tx: 'var(--color-b3-tx)', solid: 'var(--color-b3)', soft: 'var(--color-b3-soft)' },
  4: { bg: 'var(--color-b4-bg)', tx: 'var(--color-b4-tx)', solid: 'var(--color-b4)', soft: 'var(--color-b4-soft)' }
}

export const BOXES: Box[] = [1, 2, 3, 4]

export function boxOf(urgent: boolean, important: boolean): Box {
  if (urgent && important) return 1
  if (important) return 2
  if (urgent) return 3
  return 4
}

export const PROFILE_COLORS = ['#0F6E64', '#C2510F', '#5B4BA8', '#2563A8', '#1A1A17']
export const DEFAULT_AREAS = ['Dev Hub', 'Explained', 'Sticky Figure It Out', 'WonderRoute', 'Server', 'Personal']

/** Inverse of boxOf: the urgent / important flags a box stands for. */
export function boxFlags(box: Box): { urgent: boolean, important: boolean } {
  return { urgent: box === 1 || box === 3, important: box === 1 || box === 2 }
}
