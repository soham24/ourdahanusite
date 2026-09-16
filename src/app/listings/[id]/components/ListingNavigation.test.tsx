import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'

import ListingNavigation from './ListingNavigation'

test('business subdomain navigation sticks to the top because it has no site navbar', () => {
  const html = renderToStaticMarkup(
    <ListingNavigation hasCatalog={false} photos={[]} hasSiteNavbar={false} />,
  )

  assert.match(html, /sticky top-0/)
  assert.doesNotMatch(html, /top-\[62px\]/)
})

test('main-site listing navigation clears the site navbar', () => {
  const html = renderToStaticMarkup(
    <ListingNavigation hasCatalog={false} photos={[]} hasSiteNavbar />,
  )

  assert.match(html, /top-\[62px\]/)
})
