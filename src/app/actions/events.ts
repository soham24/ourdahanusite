'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function submitEvent(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const title = formData.get('title') as string
  const description = formData.get('description') as string
  const date = formData.get('date') as string
  const time_start = formData.get('time_start') as string
  const time_end = formData.get('time_end') as string
  const location = formData.get('location') as string
  const category = formData.get('category') as string
  const is_free = formData.get('is_free') === 'on'
  const price = is_free ? null : Number(formData.get('price') || 0)
  const image_url = (formData.get('image_url') as string) || null

  const { error } = await supabase.from('events').insert({
    organizer_id: user.id,
    title,
    description,
    date,
    time_start,
    time_end,
    location,
    category,
    is_free,
    price,
    image_url,
    approved: false,
  })

  if (error) throw new Error(error.message)

  void import('@/lib/notify-admin').then(m =>
    m.notifyAdmin('event', title, user!.email ?? undefined)
  )

  revalidatePath('/events')
  redirect('/events?submitted=1')
}

export async function rsvpEvent(eventId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase.from('event_rsvps').upsert(
    { event_id: eventId, user_id: user.id },
    { onConflict: 'event_id,user_id' }
  )

  if (error) throw new Error(error.message)

  revalidatePath('/events/' + eventId)
}

export async function cancelRsvp(eventId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase
    .from('event_rsvps')
    .delete()
    .eq('event_id', eventId)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)

  revalidatePath('/events/' + eventId)
}
