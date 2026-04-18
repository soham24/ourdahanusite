/**
 * Shared Warli-themed email layout used by all notification renderers.
 */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export interface EmailLayoutParams {
  eyebrow: string
  headline: string
  /** Pre-rendered safe HTML for the intro paragraph. */
  introHtml: string
  /** Pre-rendered safe HTML for the detail table rows. */
  detailRows?: string
  ctaUrl?: string
  ctaText?: string
  footerNote?: string
}

export function renderEmailLayout(params: EmailLayoutParams): string {
  const eyebrow = escapeHtml(params.eyebrow)
  const headline = escapeHtml(params.headline)
  const footer = escapeHtml(params.footerNote ?? 'OurDahanu — Dahanu’s Community Portal')
  const ctaBlock =
    params.ctaUrl && params.ctaText
      ? `<a href="${params.ctaUrl}" style="display:inline-block;background:#C4663A;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;font-size:15px;">${escapeHtml(params.ctaText)} &rarr;</a>`
      : ''
  const detailBlock = params.detailRows
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:10px;padding:20px;margin-bottom:24px;">${params.detailRows}</table>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#FBF0DC;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FBF0DC;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#3D1A08,#C4663A);padding:24px 32px;">
            <p style="margin:0;color:#F7E7D6;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;">${eyebrow}</p>
            <h1 style="margin:8px 0 0;color:#FBF0DC;font-size:22px;font-weight:700;">OurDahanu</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h2 style="margin:0 0 12px;color:#1a1a1a;font-size:22px;font-weight:700;">${headline}</h2>
            <p style="margin:0 0 24px;color:#555;font-size:15px;line-height:1.65;">${params.introHtml}</p>
            ${detailBlock}
            ${ctaBlock}
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:16px 32px;text-align:center;">
            <p style="margin:0;color:#aaa;font-size:12px;">${footer}</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export function buildDetailRow(label: string, value: string, bordered = true): string {
  return `<tr><td style="padding:6px 0;${bordered ? 'border-top:1px solid #eee;' : ''}">
    <span style="color:#888;font-size:12px;font-weight:600;text-transform:uppercase;">${escapeHtml(label)}</span><br/>
    <span style="color:#1a1a1a;font-size:15px;">${value}</span>
  </td></tr>`
}
