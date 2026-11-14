import type { Box } from '~/types'

export interface BoxStyle { bg: string, tx: string, solid: string, soft: string }

/** Urgent/important matrix colours, straight from the design. */
export const BOX_STYLES: Record<Box, BoxStyle> = {
  1: { bg: '#FBE9DF', tx: '#8A3409', solid: '#C2510F', soft: '#F3CDB8' },
  2: { bg: '#E3F0EC', tx: '#0A4F48', solid: '#0F6E64', soft: '#C4DED6' },
  3: { bg: '#F6EDCF', tx: '#5E4900', solid: '#B08A00', soft: '#E9DBA6' },
  4: { bg: '#ECEAE4', tx: '#4A4943', solid: '#8E8C85', soft: '#D8D5CC' }
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
