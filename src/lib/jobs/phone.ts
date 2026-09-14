/**
 * Normalise an Indian phone number to its 10 significant digits.
 *
 * Accepts a +91 / 91 country prefix, a leading trunk 0, and any spaces,
 * dashes or brackets. Returns null when what remains is not a valid number.
 * Mobiles start 6–9; landlines with their STD code (e.g. Dahanu 02528…)
 * start 1–5.
 */
export function normalizeIndianPhone(raw: string): string | null {
  let digits = (raw ?? '').replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2)
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1)
  return /^[1-9]\d{9}$/.test(digits) ? digits : null
}

export function isIndianMobile(phone10: string): boolean {
  return /^[6-9]\d{9}$/.test(phone10)
}

export function telHrefIndia(phone10: string): string {
  return `tel:+91${phone10}`
}

export function waHrefIndia(phone10: string): string {
  return `https://wa.me/91${phone10}`
}

/** "98765 43210" for mobiles; landlines get their trunk 0 back. */
export function formatIndianPhone(phone10: string): string {
  return isIndianMobile(phone10) ? `${phone10.slice(0, 5)} ${phone10.slice(5)}` : `0${phone10}`
}
