import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'

import ExpandableDescription from './ExpandableDescription'

const LONG = 'Citrus Bloom Cleanser is a gentle yet effective face wash designed as the first step of your ritual, infused with lemon powder, sweetlime hydrosol and lily lotus.'
const SHORT = 'A gentle face wash.'

test('a long description ships its toggle in the server HTML', () => {
  // The toggle used to be decided only after mount, so it appeared on
  // hydration and pushed every card below it down the page.
  const html = renderToStaticMarkup(<ExpandableDescription text={LONG} />)
  assert.match(html, /Read more/)
})

test('a short description ships no toggle', () => {
  const html = renderToStaticMarkup(<ExpandableDescription text={SHORT} />)
  assert.doesNotMatch(html, /Read more/)
})

test('the collapsed paragraph carries the clamp', () => {
  const html = renderToStaticMarkup(<ExpandableDescription text={LONG} />)
  assert.match(html, /line-clamp-3/)
})

test('a caller can choose a different clamp', () => {
  const html = renderToStaticMarkup(
    <ExpandableDescription text={LONG} clampClassName="line-clamp-5" />,
  )
  assert.match(html, /line-clamp-5/)
  assert.doesNotMatch(html, /line-clamp-3/)
})

test('soft line breaks are joined before the text is rendered', () => {
  const html = renderToStaticMarkup(
    <ExpandableDescription text={'designed as the\nfirst step of your ritual'} />,
  )
  assert.match(html, /designed as the first step/)
})

test('structured lines keep their breaks', () => {
  const html = renderToStaticMarkup(
    <ExpandableDescription text={'Delivery: free above Rs 500.\nReturns: within 7 days.'} />,
  )
  assert.match(html, /Rs 500\.\nReturns/)
})

test('the toggle names the item, so eight of them on one page are distinguishable', () => {
  const html = renderToStaticMarkup(
    <ExpandableDescription text={LONG} label="Citrus Bloom Cleanser" />,
  )
  assert.match(html, /aria-label="Read more about Citrus Bloom Cleanser"/)
})

test('the toggle points at the paragraph it opens', () => {
  const html = renderToStaticMarkup(<ExpandableDescription text={LONG} />)
  const controls = /aria-controls="([^"]+)"/.exec(html)
  assert.ok(controls, 'expected aria-controls on the toggle')
  assert.match(html, new RegExp(`id="${controls[1]}"`))
  assert.match(html, /aria-expanded="false"/)
})

test('the extra class names reach the paragraph', () => {
  const html = renderToStaticMarkup(
    <ExpandableDescription text={SHORT} className="text-sm text-muted" />,
  )
  assert.match(html, /text-sm text-muted/)
})
