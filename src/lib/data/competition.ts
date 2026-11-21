import type { LeaderboardEntry } from './game'

// Data for /play comes from the bundles in ./play.ts; these are the shapes.

export interface TodayCompetition {
  id: string
  title: string
  prize: string
  day: string
}

export interface PastCompetition extends TodayCompetition {
  top: LeaderboardEntry[]
}
