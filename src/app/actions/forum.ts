'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

const CATEGORY_SLUG_MAP: Record<string, string> = {
  'General Chat': 'general',
  'Neighbours Helping Neighbours': 'help',
  'Local Issues': 'local-issues',
  'Recommendations': 'recommendations',
  'Farming & Agriculture': 'farming',
  'Fishing Community': 'fishing',
  'Education & Students': 'education',
  'Pets & Animals': 'pets',
  'Home & Gardening': 'gardening',
  'Youth & Sports': 'youth',
}

export async function createThread(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const authorName = profile?.full_name || user.email?.split('@')[0] || 'Member'

  const category = formData.get('category') as string
  const title = formData.get('title') as string
  const body = formData.get('body') as string
  const categorySlug = CATEGORY_SLUG_MAP[category] || 'general'

  const { data, error } = await supabase.from('forum_threads').insert({
    author_id: user.id,
    author_name: authorName,
    category,
    category_slug: categorySlug,
    title,
    body,
    reply_count: 0,
    view_count: 0,
    upvotes: 0,
    pinned: false,
    approved: true,
    last_activity_at: new Date().toISOString(),
  }).select('id').single()

  if (error) throw new Error(error.message)

  void import('@/lib/notify-admin').then(m =>
    m.notifyAdmin('forum', title, authorName)
  )

  revalidatePath('/forum')
  redirect('/forum/' + data.id)
}

export async function postReply(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const authorName = profile?.full_name || user.email?.split('@')[0] || 'Member'

  const threadId = formData.get('thread_id') as string
  const body = formData.get('body') as string

  const { error: replyError } = await supabase.from('forum_replies').insert({
    thread_id: threadId,
    author_id: user.id,
    author_name: authorName,
    body,
    upvotes: 0,
  })

  if (replyError) throw new Error(replyError.message)

  // Update reply count and last_activity_at on the thread
  await supabase
    .from('forum_threads')
    .update({ last_activity_at: new Date().toISOString() })
    .eq('id', threadId)

  try {
    await supabase.rpc('increment_reply_count', { thread_id: threadId }).maybeSingle()
  } catch {
    // gracefully ignore if RPC doesn't exist
  }

  revalidatePath('/forum/' + threadId)
}
