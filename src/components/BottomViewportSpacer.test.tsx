import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'

import BottomViewportSpacer from './BottomViewportSpacer'

test('site tab spacer reserves scroll room below the footer on phones and tablets', () => {
  const html = renderToStaticMarkup(<BottomViewportSpacer until="lg" />)

  assert.match(html, /aria-hidden="true"/)
  assert.match(html, /h-\[calc\(4rem\+env\(safe-area-inset-bottom,0px\)\)\]/)
  assert.match(html, /lg:hidden/)
})

test('business action spacer stops at the desktop listing breakpoint', () => {
  const html = renderToStaticMarkup(<BottomViewportSpacer until="md" />)

  assert.match(html, /md:hidden/)
})
