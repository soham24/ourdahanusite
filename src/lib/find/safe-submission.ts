const FRIENDLY_SUBMISSION_ERROR =
  'Something went wrong while submitting. Please try again.'

export async function safelySubmit<T>(
  submit: () => Promise<T>,
): Promise<T | { error: string }> {
  try {
    return await submit()
  } catch {
    return { error: FRIENDLY_SUBMISSION_ERROR }
  }
}
