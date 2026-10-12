import assert from 'node:assert/strict'
import test from 'node:test'

import { renderNotification } from './templates'
import { ROOT_DOMAIN } from '@/lib/site-config'

test('job.approved links to the live post', () => {
  const rendered = renderNotification('job.approved', { postId: 'p1', title: 'Cook', kind: 'hiring' })
  assert.equal(rendered.title, '✅ Your job post is live · Cook')
  assert.equal(rendered.link, '/jobs/j/p1')
  assert.ok((rendered.email?.html ?? '').includes(`https://jobs.${ROOT_DOMAIN}/j/p1`))
})

test('job.rejected carries the reason, escaped in the email', () => {
  const rendered = renderNotification('job.rejected', { postId: 'p1', title: 'Driver', kind: 'seeking', reason: 'Asks for <money>' })
  assert.equal(rendered.title, 'Your profile was not approved · Driver')
  assert.equal(rendered.link, '/jobs/my-posts')
  assert.match(rendered.body, /Asks for <money>/)
  assert.match(rendered.email?.html ?? '', /Asks for &lt;money&gt;/)
  assert.equal((rendered.email?.html ?? '').includes('<money>'), false)
})

test('job.expiring says "1 day", not "1 days"', () => {
  assert.equal(
    renderNotification('job.expiring', { postId: 'p1', title: 'Cook', kind: 'hiring', daysLeft: 1 }).title,
    '⏳ Your job post expires in 1 day · Cook',
  )
  assert.equal(
    renderNotification('job.expiring', { postId: 'p1', title: 'Cook', kind: 'hiring', daysLeft: 3 }).title,
    '⏳ Your job post expires in 3 days · Cook',
  )
})

test('admin submissions label job posts and job reports', () => {
  assert.equal(
    renderNotification('admin.new_submission', { kind: 'job', title: 'Cook', reviewPath: '/admin/jobs' }).title,
    'New Job post submission',
  )
  assert.equal(
    renderNotification('admin.new_submission', { kind: 'job_report', title: 'Cook · asks_for_money', reviewPath: '/admin/jobs' }).title,
    'New Job report submission',
  )
})
