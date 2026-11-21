/**
 * Validation for a customer's enquiry to a business. Pure, so the rules the
 * form shows and the rules the server enforces are the same code.
 */

import { normalizeInlineText, normalizeMultilineText } from './listing-content'

export const ENQUIRY_LIMITS = {
  name: 80,
  message: 1000,
  /** Per sender, across all businesses, in 24 hours. */
  perDay: 10,
  /** Per sender to one business, in 24 hours. */
  perListingPerDay: 3,
} as const

export type EnquiryInput = { name: string; phone: string; message: string }
export type EnquiryValues = EnquiryInput

/** Digits, with an optional leading +; spaces, dashes and brackets dropped. */
export function normalizePhone(value: string): string {
  const trimmed = value.trim()
  const digits = trimmed.replace(/\D/g, '')
  return trimmed.startsWith('+') ? `+${digits}` : digits
}

export function validateEnquiry(input: EnquiryInput): { values: EnquiryValues } | { error: string } {
  const name = normalizeInlineText(input.name, ENQUIRY_LIMITS.name)
  if (!name) return { error: 'Please enter your name.' }

  const phone = normalizePhone(input.phone ?? '')
  const digits = phone.replace(/\D/g, '').length
  if (digits < 10 || digits > 15) return { error: 'Please enter a phone number the business can call you on.' }

  const message = normalizeMultilineText(input.message, ENQUIRY_LIMITS.message)
  if (!message) return { error: 'Please write your message.' }

  return { values: { name, phone, message } }
}
