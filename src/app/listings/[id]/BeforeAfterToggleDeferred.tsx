'use client'

import dynamic from 'next/dynamic'

const BeforeAfterToggle = dynamic(() => import('./BeforeAfterToggle'))

interface Props {
  before: string
  after: string
}

export default function BeforeAfterToggleDeferred({ before, after }: Props) {
  return <BeforeAfterToggle before={before} after={after} />
}
