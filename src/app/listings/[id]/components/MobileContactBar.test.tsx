import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'

import MobileContactBar from './MobileContactBar'

const links = {
  phoneHref: '919876543210',
  enquiryLink: 'https://wa.me/919876543210',
  directionsUrl: 'https://maps.google.com/?q=Dahanu',
}

test('business subdomain contact bar docks to the viewport bottom', () => {
  const html = renderToStaticMarkup(<MobileContactBar {...links} hasSiteTabs={false} />)

  assert.match(html, /bottom:env\(safe-area-inset-bottom, 0px\)/)
  assert.doesNotMatch(html, /bottom:calc\(4rem/)
})

test('main-site contact bar clears the mobile site tabs', () => {
  const html = renderToStaticMarkup(<MobileContactBar {...links} hasSiteTabs />)

  assert.match(html, /bottom:calc\(4rem \+ env\(safe-area-inset-bottom, 0px\)\)/)
})
