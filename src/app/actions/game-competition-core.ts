import { codesMatch } from '../../lib/game/competition'

export const CODE_ATTEMPT_LIMIT = 10
export const CODE_ATTEMPT_WINDOW_MS = 600_000

export interface CompetitionDeps {
  today(): string
  findActive(day: string): Promise<{ id: string; code: string } | null>
  hasDisplayName(userId: string): Promise<boolean>
  attemptsBlocked(userId: string): boolean
  recordWrongAttempt(userId: string): void
}

export type CodeCheck =
  | { ok: true; competitionId: string }
  | {
      ok: false
      reason: 'no_competition' | 'wrong_code' | 'too_many' | 'need_name'
      message: string
    }

export async function checkCode(
  userId: string,
  rawCode: string,
  deps: CompetitionDeps,
): Promise<CodeCheck> {
  if (!(await deps.hasDisplayName(userId))) {
    return {
      ok: false,
      reason: 'need_name',
      message: 'Add a display name first so we can show you on the board.',
    }
  }
  if (deps.attemptsBlocked(userId)) {
    return { ok: false, reason: 'too_many', message: 'Too many tries. Please wait a few minutes.' }
  }
  const active = await deps.findActive(deps.today())
  if (!active) {
    return { ok: false, reason: 'no_competition', message: 'There is no competition running right now.' }
  }
  if (!codesMatch(rawCode, active.code)) {
    deps.recordWrongAttempt(userId)
    return { ok: false, reason: 'wrong_code', message: "That code didn't work. Check it and try again." }
  }
  return { ok: true, competitionId: active.id }
}
