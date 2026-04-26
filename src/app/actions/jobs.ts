'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { revalidatePublicJobs } from '@/lib/cache-tags'
import { sendNotificationToAdmins } from '@/lib/notifications'
import {
  fetchRazorpayOrder,
  getJobSubmissionCharge,
  validateRazorpayOrder,
} from '@/lib/payment-security'

/** Fire-and-forget: email all admins + job_reviewers about a new job submission */
async function notifyJobReviewers(jobTitle: string, company: string, jobId: string) {
  try {
    if (!process.env.RESEND_API_KEY) return

    const adminClient = createAdminClient()
    if (!adminClient) return

    const { data: reviewers } = await adminClient
      .from('profiles')
      .select('id')
      .in('role', ['admin', 'job_reviewer'])

    if (!reviewers || reviewers.length === 0) return

    const emails: string[] = []
    for (const r of reviewers) {
      const { data: { user } } = await adminClient.auth.admin.getUserById(r.id)
      if (user?.email) emails.push(user.email)
    }

    const adminEmail = process.env.ADMIN_EMAIL
    if (adminEmail && !emails.includes(adminEmail)) emails.push(adminEmail)
    if (emails.length === 0) return

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ourdahanu.in'
    const reviewUrl = jobId ? `${siteUrl}/admin/jobs?focus=${encodeURIComponent(jobId)}` : `${siteUrl}/admin/jobs`
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)

    await resend.emails.send({
      from: 'OurDahanu <hello@ourdahanu.in>',
      to: emails,
      subject: `🆕 New job posted: ${jobTitle} at ${company}`,
      html: `<!DOCTYPE html><html><body style="background:#FBF0DC;font-family:sans-serif;padding:32px 0;">
<table width="560" style="background:#fff;border-radius:16px;margin:0 auto;">
<tr><td style="background:#16a34a;padding:24px 32px;"><h1 style="margin:0;color:#fff;font-size:22px;">OurDahanu Jobs</h1></td></tr>
<tr><td style="padding:32px;">
  <h2 style="margin:0 0 8px;color:#1a1a1a;">New Job Submission</h2>
  <p style="color:#555;margin:0 0 20px;">A new paid job posting needs review.</p>
  <p><strong>${jobTitle}</strong> at ${company}</p>
  <a href="${reviewUrl}" style="background:#16a34a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;">Review Job →</a>
</td></tr>
</table></body></html>`,
    })
  } catch (err) {
    console.error('[notifyJobReviewers]', err)
  }
}

function extractJobFields(formData: FormData) {
  return {
    title:         (formData.get('title')         as string)?.trim(),
    company:       (formData.get('company')       as string)?.trim(),
    category:      (formData.get('category')      as string)?.trim(),
    type:          (formData.get('type')          as string)?.trim() || 'Full-time',
    location:      (formData.get('location')      as string)?.trim() || null,
    salary:        (formData.get('salary')        as string)?.trim() || null,
    description:   (formData.get('description')   as string)?.trim(),
    requirements:  (formData.get('requirements')  as string)?.trim() || null,
    contact_email:      (formData.get('contact_email')      as string)?.trim() || null,
    contact_phone:      (formData.get('contact_phone')      as string)?.trim() || null,
    contact_phone_type: (formData.get('contact_phone_type') as string)?.trim() || 'both',
    positions:          parseInt(formData.get('positions') as string) || 1,
  }
}

/** Paid submission — verifies Razorpay signature then inserts the job. */
export async function submitPaidJob(
  formData: FormData
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Please sign in first.' }

  const paymentId = (formData.get('razorpay_payment_id') as string)?.trim()
  const orderId   = (formData.get('razorpay_order_id')   as string)?.trim()
  const signature = (formData.get('razorpay_signature')  as string)?.trim()
  const couponUsed = (formData.get('coupon_used') as string)?.trim() || null

  if (!paymentId || !orderId || !signature) {
    return { error: 'Payment details are missing. Please try again.' }
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim()
  if (!keySecret) return { error: 'Payment gateway not configured.' }

  const { createHmac } = await import('crypto')
  const expected = createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex')
  if (expected !== signature) {
    return { error: 'Payment verification failed. Please contact support.' }
  }

  const charge = await getJobSubmissionCharge(couponUsed)
  if (couponUsed && !charge.couponValid) {
    return { error: 'Coupon code is invalid or inactive.' }
  }
  if (charge.isFree) {
    return { error: 'This coupon makes the job free. Please submit through the free path.' }
  }

  const razorpayOrder = await fetchRazorpayOrder(orderId)
  const paymentOrderError = validateRazorpayOrder({
    order: razorpayOrder,
    flow: 'job',
    userId: user.id,
    expectedAmountPaise: charge.finalPrice * 100,
    expectedNotes: { flow: 'job', buyer_id: user.id },
  })
  if (paymentOrderError) {
    return { error: paymentOrderError }
  }

  const fields = extractJobFields(formData)
  if (!fields.title || !fields.company || !fields.category || !fields.description) {
    return { error: 'Title, company, category and description are required.' }
  }

  const { data: inserted, error } = await supabase.from('jobs').insert({
    ...fields,
    posted_by: user.id,
    approved: false,
    payment_id: paymentId,
    payment_status: 'paid',
    coupon_used: charge.couponValid ? charge.couponCode : null,
    amount_paid: charge.finalPrice,
    status: 'open',
  }).select('id').single()

  if (error) return { error: error.message }

  if (charge.couponValid && charge.couponCode) {
    const { incrementCouponUsage } = await import('./pricing')
    await incrementCouponUsage(charge.couponCode)
  }

  notifyJobReviewers(fields.title, fields.company, inserted?.id ?? '')
  void sendNotificationToAdmins('admin.new_submission', {
    kind: 'job',
    title: fields.title,
    submitterName: fields.company,
    reviewPath: '/admin/jobs',
  }).catch(err => console.error('[notify:new-job-paid]', err))

  revalidatePublicJobs()
  return {}
}

/** Free coupon path — no Razorpay needed but coupon must be valid & free. */
export async function submitFreeJob(
  formData: FormData
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Please sign in first.' }

  const fields = extractJobFields(formData)
  if (!fields.title || !fields.company || !fields.category || !fields.description) {
    return { error: 'Title, company, category and description are required.' }
  }

  const couponUsed = (formData.get('coupon_used') as string)?.trim() || null
  const charge = await getJobSubmissionCharge(couponUsed)

  if (!couponUsed || !charge.couponValid) {
    return { error: 'A valid free coupon is required.' }
  }
  if (!charge.isFree) {
    return { error: 'This coupon does not make the job posting free.' }
  }

  const { data: inserted, error } = await supabase.from('jobs').insert({
    ...fields,
    posted_by: user.id,
    approved: false,
    payment_status: 'free_coupon',
    coupon_used: charge.couponCode,
    amount_paid: 0,
    status: 'open',
  }).select('id').single()

  if (error) return { error: error.message }

  if (charge.couponCode) {
    const { incrementCouponUsage } = await import('./pricing')
    await incrementCouponUsage(charge.couponCode)
  }

  notifyJobReviewers(fields.title, fields.company, inserted?.id ?? '')
  void sendNotificationToAdmins('admin.new_submission', {
    kind: 'job',
    title: fields.title,
    submitterName: fields.company,
    reviewPath: '/admin/jobs',
  }).catch(err => console.error('[notify:new-job-free]', err))

  revalidatePublicJobs()
  return {}
}

/** Update job status — poster or admin only. */
export async function updateJobStatus(
  jobId: string,
  status: 'open' | 'hiring' | 'closed'
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  // Fetch job to check ownership
  const { data: job } = await supabase
    .from('jobs')
    .select('posted_by, approved')
    .eq('id', jobId)
    .single()

  if (!job) return { error: 'Job not found.' }

  // Check admin role
  const adminClient = createAdminClient()
  let isAdmin = false
  if (adminClient) {
    const { data: profile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    isAdmin = profile?.role === 'admin' || profile?.role === 'moderator'
  }

  if (!isAdmin && job.posted_by !== user.id) {
    return { error: 'Not authorized.' }
  }

  if (!isAdmin && !job.approved && status !== 'closed') {
    return { error: 'Pending jobs can only be published by an admin after review.' }
  }

  const updatePayload: { status: 'open' | 'hiring' | 'closed'; approved?: boolean } = isAdmin
    ? {
        status,
        approved: status === 'closed' ? job.approved : true,
      }
    : {
        status,
      }

  const { error } = await supabase
    .from('jobs')
    .update(updatePayload)
    .eq('id', jobId)

  if (error) return { error: error.message }

  revalidatePublicJobs()
  return {}
}
