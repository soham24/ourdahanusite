'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function submitNews(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const title     = formData.get('title') as string
  const category  = formData.get('category') as string
  const excerpt   = formData.get('excerpt') as string
  const content   = formData.get('content') as string
  const author    = (formData.get('author') as string) || user.user_metadata?.full_name || user.email
  const image_url = (formData.get('image_url') as string) || null

  if (!title || !category || !content) {
    throw new Error('Title, category and content are required.')
  }

  const { error } = await supabase.from('news_articles').insert({
    title,
    category,
    excerpt,
    content,
    author,
    image_url,
    published: false,
    submitted_by: user.id,
  })

  if (error) throw new Error(error.message)

  void import('@/lib/notify-admin').then(m =>
    m.notifyAdmin('news', title, author)
  )

  revalidatePath('/news')
  redirect('/news?submitted=1')
}
