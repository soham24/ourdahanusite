import { classifyRazorpayKeyId } from './keys'

export type ChecklistStepId = 'listing' | 'connect' | 'item' | 'practice' | 'live'
export type ChecklistStepState = 'done' | 'todo' | 'blocked' | 'skipped'
export type ChecklistStatus = 'setup' | 'complete' | 'suspended' | 'keys_rejected'

export interface ChecklistInput {
  approved: boolean
  paymentsEnabled: boolean
  suspendedAt: string | null
  /** A listing_payment_configs row exists, verified or not. */
  hasConfig: boolean
  verifiedAt: string | null
  keyId: string | null
  activeItemCount: number
  /** All owner_razorpay orders for the listing, test orders included. */
  orderCount: number
  testOrderCount: number
}

export interface ChecklistStep {
  id: ChecklistStepId
  state: ChecklistStepState
}

export interface SellingChecklist {
  status: ChecklistStatus
  steps: ChecklistStep[]
}

export function deriveSellingChecklist(input: ChecklistInput): SellingChecklist {
  const kind = classifyRazorpayKeyId(input.keyId)
  const connected =
    input.paymentsEnabled && Boolean(input.verifiedAt) && (kind === 'test' || kind === 'live')
  const live = connected && kind === 'live'

  const listing: ChecklistStepState = input.approved ? 'done' : 'todo'
  const connect: ChecklistStepState = connected ? 'done' : input.approved ? 'todo' : 'blocked'
  const item: ChecklistStepState =
    input.activeItemCount > 0 ? 'done' : input.approved ? 'todo' : 'blocked'
  const practice: ChecklistStepState =
    input.orderCount > 0
      ? 'done'
      : live && input.testOrderCount === 0
        ? 'skipped'
        : connected
          ? 'todo'
          : 'blocked'
  const goLive: ChecklistStepState = live ? 'done' : connected ? 'todo' : 'blocked'

  const steps: ChecklistStep[] = [
    { id: 'listing', state: listing },
    { id: 'connect', state: connect },
    { id: 'item', state: item },
    { id: 'practice', state: practice },
    { id: 'live', state: goLive },
  ]

  let status: ChecklistStatus
  if (input.suspendedAt) {
    status = 'suspended'
  } else if (input.hasConfig && !input.verifiedAt) {
    status = 'keys_rejected'
  } else if (steps.every((step) => step.state === 'done' || step.state === 'skipped')) {
    status = 'complete'
  } else {
    status = 'setup'
  }

  return { status, steps }
}
