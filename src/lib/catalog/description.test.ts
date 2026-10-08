import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isTextClamped } from './description'

test('text taller than its box is clamped', () => {
  assert.equal(isTextClamped(120, 60), true)
})

test('text that fits is not clamped', () => {
  assert.equal(isTextClamped(60, 60), false)
})

test('ignores the sub-pixel rounding browsers report for unclamped text', () => {
  assert.equal(isTextClamped(61, 60), false)
  assert.equal(isTextClamped(62, 60), false)
})

test('a real extra line still counts as clamped', () => {
  assert.equal(isTextClamped(63, 60), true)
})

test('an unmeasured element is not clamped', () => {
  assert.equal(isTextClamped(0, 0), false)
  assert.equal(isTextClamped(NaN, 60), false)
  assert.equal(isTextClamped(60, NaN), false)
})

import { softenLineBreaks } from './description'

test('joins a sentence that was hard-wrapped mid-way', () => {
  assert.equal(
    softenLineBreaks('a gentle yet effective face wash designed as the\nfirst step of your ritual.'),
    'a gentle yet effective face wash designed as the first step of your ritual.',
  )
})

test('keeps a blank line as a paragraph break', () => {
  assert.equal(softenLineBreaks('First para.\n\nSecond para.'), 'First para.\n\nSecond para.')
})

test('keeps the breaks in a bulleted list', () => {
  const list = 'Includes:\n- Cleanser\n- Toner\n- Serum'
  assert.equal(softenLineBreaks(list), list)
})

test('keeps the breaks in a numbered list', () => {
  const list = 'Steps:\n1. Wash\n2. Tone\n3) Moisturise'
  assert.equal(softenLineBreaks(list), list)
})

test('keeps breaks for bullet characters as well as hyphens', () => {
  const list = 'In the box:\n• Bottle\n• Pump'
  assert.equal(softenLineBreaks(list), list)
})

test('normalises windows line endings', () => {
  assert.equal(softenLineBreaks('one\r\ntwo'), 'one two')
  assert.equal(softenLineBreaks('one\r\n\r\ntwo'), 'one\n\ntwo')
})

test('does not leave a double space where a line ended in one', () => {
  assert.equal(softenLineBreaks('ends in a space \nnext line'), 'ends in a space next line')
})

test('leaves text with no newlines untouched', () => {
  assert.equal(softenLineBreaks('A single clean sentence.'), 'A single clean sentence.')
})

test('handles empty and missing text', () => {
  assert.equal(softenLineBreaks(''), '')
})

import { metaDescription } from './description'

test('keeps the breaks in a labelled list, the shape three live descriptions use', () => {
  const labelled =
    'Individual Health Insurance: Covers one person.\nFamily Floater Plans: One policy covers the family.\nSenior Citizen Health Insurance: For over 60s.'
  assert.equal(softenLineBreaks(labelled), labelled)
})

test('still joins a wrapped sentence that merely contains a colon later on', () => {
  assert.equal(
    softenLineBreaks('it removes makeup and revives dull skin in one step: gently\nand without stripping.'),
    'it removes makeup and revives dull skin in one step: gently and without stripping.',
  )
})

test('does not treat a long capitalised sentence as a label', () => {
  const wrapped =
    'Powered by saffron, calendula and sweetlime, it gently buffs away dead skin cells:\nnourishing as it goes.'
  assert.equal(softenLineBreaks(wrapped), wrapped.replace('\n', ' '))
})

test('a short description passes through the meta trim untouched', () => {
  assert.equal(metaDescription('A gentle face wash.'), 'A gentle face wash.')
})

test('meta trim cuts at a word boundary and marks the cut', () => {
  const out = metaDescription('word '.repeat(80), 60)
  assert.ok(out.length <= 61, `too long: ${out.length}`)
  assert.ok(out.endsWith('…'))
  assert.ok(!out.includes('wor…'))
})

test('meta trim flattens newlines so a preview is one line', () => {
  assert.equal(metaDescription('one\ntwo\n\nthree'), 'one two three')
})

test('meta trim does not leave a dangling comma before the ellipsis', () => {
  assert.equal(metaDescription('lemon powder, sweetlime hydrosol, and lily lotus', 22), 'lemon powder…')
})

test('meta trim falls back to a hard cut when one word fills the budget', () => {
  const out = metaDescription('a' + 'b'.repeat(80), 20)
  assert.equal(out.length, 21)
  assert.ok(out.endsWith('…'))
})

import { likelyClamped } from './description'

test('a labelled line that merely wrapped is joined, not left stranded', () => {
  assert.equal(
    softenLineBreaks('Delivery: we deliver within Dahanu for free on orders\nabove Rs 500.'),
    'Delivery: we deliver within Dahanu for free on orders above Rs 500.',
  )
})

test('consecutive labelled entries still keep their breaks', () => {
  const entries = 'Delivery: free above Rs 500.\nReturns: within 7 days.\nSupport: on WhatsApp.'
  assert.equal(softenLineBreaks(entries), entries)
})

test('a wrapped list item joins back onto its bullet', () => {
  assert.equal(
    softenLineBreaks('- Cleanser for all skin types and\nevery season\n- Toner'),
    '- Cleanser for all skin types and every season\n- Toner',
  )
})

test('meta trim never splits an emoji in half', () => {
  const out = metaDescription('a' + '\u{1F33F}'.repeat(150), 20)
  // A lone surrogate is a code unit in the D800-DFFF range with no partner.
  for (let i = 0; i < out.length; i += 1) {
    const code = out.charCodeAt(i)
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = out.charCodeAt(i + 1)
      assert.ok(next >= 0xdc00 && next <= 0xdfff, `lone high surrogate at ${i}`)
      i += 1
    } else {
      assert.ok(!(code >= 0xdc00 && code <= 0xdfff), `lone low surrogate at ${i}`)
    }
  }
})

test('guesses a toggle is needed for text past three lines, and not before', () => {
  assert.equal(likelyClamped('Short and sweet.'), false)
  assert.equal(likelyClamped('x'.repeat(126)), false)
  assert.equal(likelyClamped('x'.repeat(127)), true)
})

test('the guess measures the softened text, not the raw newlines', () => {
  // Hard-wrapped at 20 chars: six short lines that become one 119-char line.
  const wrapped = Array.from({ length: 6 }, () => 'nineteen chars here').join('\n')
  assert.equal(likelyClamped(wrapped), false)
})
