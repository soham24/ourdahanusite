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
