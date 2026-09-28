import { connection, NextResponse } from 'next/server'

import { runAppointmentReminders } from '@/lib/cron/appointment-reminders'
import { createAdminClient } from '@/lib/supabase/admin-client'
import { bearerToken, isConfigured, secretMatches } from '@/lib/http/shared-secret'

export async function GET(request: Request) {
  await connection()

  const cronSecret = process.env.CRON_SECRET
  if (!isConfigured(cronSecret)) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 })
  }

  if (!secretMatches(bearerToken(request.headers.get('authorization')), cronSecret.trim())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminClient = createAdminClient()
  if (!adminClient) {
    return NextResponse.json({ error: 'Admin client unavailable' }, { status: 500 })
  }

  const stats = await runAppointmentReminders(adminClient)

  console.log('[cron/appointment-reminders]', stats)
  return NextResponse.json({ ok: true, ...stats })
}
