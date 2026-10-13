/**
 * Receives Content-Security-Policy violation reports (see src/lib/csp.ts)
 * and logs one line per report, so Vercel's logs show what the policy would
 * block before it is enforced. Stores nothing.
 */
const MAX_BODY = 16_384

type Report = Record<string, unknown>

export async function POST(request: Request) {
  const text = (await request.text()).slice(0, MAX_BODY)
  let reports: Report[] = []
  try {
    const body = JSON.parse(text)
    // `report-uri` posts {"csp-report": {...}}; the Reporting API posts an
    // array of {type, body: {...}}.
    reports = Array.isArray(body)
      ? body.map((entry) => (entry?.body ?? {}) as Report)
      : [(body?.['csp-report'] ?? {}) as Report]
  } catch {
    return new Response(null, { status: 400 })
  }
  for (const report of reports.slice(0, 10)) {
    console.warn('[csp-report]', JSON.stringify({
      directive: report['violated-directive'] ?? report.effectiveDirective,
      blocked: report['blocked-uri'] ?? report.blockedURL,
      page: report['document-uri'] ?? report.documentURL,
    }))
  }
  return new Response(null, { status: 204 })
}
