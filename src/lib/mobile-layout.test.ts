import assert from 'node:assert/strict'
import test from 'node:test'

import { floatingPanelBottomClasses, paymentRecoveryBottom } from './mobile-layout'

test('floating panels clear mobile tabs until the tabs disappear at the large breakpoint', () => {
  const classes = floatingPanelBottomClasses()

  assert.match(classes, /bottom-\[calc\(5rem\+env\(safe-area-inset-bottom\)\)\]/)
  assert.match(classes, /lg:bottom-6/)
  assert.doesNotMatch(classes, /sm:bottom-6/)
})

test('payment recovery only leaves room for bottom chrome when bottom chrome exists', () => {
  assert.equal(paymentRecoveryBottom(false), 'calc(1rem + env(safe-area-inset-bottom, 0px))')
  assert.equal(paymentRecoveryBottom(true), 'calc(4.5rem + env(safe-area-inset-bottom, 0px))')
})
