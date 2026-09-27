import { test } from 'node:test'
import assert from 'node:assert/strict'
import { subsetText } from './og-font'

test('covers every printable ASCII character, so a card cannot render a glyph the subset lacks', () => {
  const text = subsetText()
  for (let code = 32; code <= 126; code += 1) {
    assert.ok(
      text.includes(String.fromCharCode(code)),
      `missing U+${code.toString(16).padStart(4, '0')} (${String.fromCharCode(code)})`,
    )
  }
})

test('covers the exact characters the /play card renders, which a hand-written subset had missed', () => {
  const text = subsetText()
  for (const char of ',W&') {
    assert.ok(text.includes(char), `missing ${char}`)
  }
})

test('adds non-ASCII characters from the caller text', () => {
  const text = subsetText('Café Kadam — naïve')
  assert.ok(text.includes('é'))
  assert.ok(text.includes('—'))
  assert.ok(text.includes('ï'))
})

test('does not repeat characters already covered by ASCII', () => {
  assert.equal(subsetText('Ramesh Kadam'), subsetText())
})

test('includes each new character once, however often the caller repeats it', () => {
  const text = subsetText('ééé—é')
  assert.equal(text.split('é').length - 1, 1)
  assert.equal(text.split('—').length - 1, 1)
})

test('an empty caller string is the plain ASCII range', () => {
  assert.equal(subsetText(''), subsetText())
  assert.equal(subsetText(), subsetText(undefined))
})
