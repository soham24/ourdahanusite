'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { ChevronDown, ChevronUp, MessageCircleQuestion, Send } from 'lucide-react'

import { askQuestion, answerQuestion } from '@/app/actions/listing-interactions'
import { buildAbsoluteUrl } from '@/lib/site'

interface Question {
  id: string
  question: string
  answer: string | null
  answered_at: string | null
  created_at: string
  user_id: string | null
}

interface Props {
  listingId: string
  subdomain?: string | null
  questions: Question[]
  isOwner: boolean
  isLoggedIn: boolean
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function QASection({ listingId, subdomain, questions: initial, isOwner, isLoggedIn }: Props) {
  const [questions, setQuestions] = useState(initial)
  const [questionText, setQuestionText] = useState('')
  const [answerTexts, setAnswerTexts] = useState<Record<string, string>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [isPending, startTransition] = useTransition()
  const [submitError, setSubmitError] = useState('')
  const [submitSuccess, setSubmitSuccess] = useState(false)

  const handleAsk = () => {
    if (!isLoggedIn) {
      window.location.href = buildAbsoluteUrl(`/login?next=${encodeURIComponent(window.location.pathname)}`)
      return
    }
    if (!questionText.trim()) return

    setSubmitError('')
    startTransition(async () => {
      const res = await askQuestion(listingId, questionText, subdomain)
      if (res.error) {
        setSubmitError(res.error)
        return
      }

      setSubmitSuccess(true)
      setQuestionText('')
      setTimeout(() => setSubmitSuccess(false), 3000)
    })
  }

  const handleAnswer = (qId: string) => {
    const answer = answerTexts[qId]?.trim()
    if (!answer) return

    startTransition(async () => {
      const res = await answerQuestion(qId, answer, listingId, subdomain)
      if (res.error) return

      setQuestions((currentQuestions) =>
        currentQuestions.map((question) =>
          question.id === qId
            ? { ...question, answer, answered_at: new Date().toISOString() }
            : question,
        ),
      )
      setAnswerTexts((currentAnswers) => ({ ...currentAnswers, [qId]: '' }))
    })
  }

  return (
    <div>
      {questions.length > 0 ? (
        <div className="space-y-3 mb-5">
          {questions.map((question) => (
            <div key={question.id} className="overflow-hidden rounded-xl border border-gray-100">
              <button
                className="flex w-full items-start justify-between gap-3 p-4 text-left transition-colors hover:bg-gray-50"
                onClick={() =>
                  setExpanded((current) => ({
                    ...current,
                    [question.id]: !current[question.id],
                  }))
                }
              >
                <div className="flex min-w-0 flex-1 items-start gap-2">
                  <MessageCircleQuestion size={16} className="mt-0.5 flex-shrink-0 text-warli-terra" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{question.question}</p>
                    <p className="mt-0.5 text-xs text-gray-400">{formatDate(question.created_at)}</p>
                  </div>
                </div>
                {expanded[question.id] ? (
                  <ChevronUp size={15} className="flex-shrink-0 text-gray-400" />
                ) : (
                  <ChevronDown size={15} className="flex-shrink-0 text-gray-400" />
                )}
              </button>

              {expanded[question.id] ? (
                <div className="space-y-3 px-4 pb-4">
                  {question.answer ? (
                    <div className="ml-6 rounded-xl border border-warli-sand bg-warli-light p-3">
                      <p className="mb-1 text-xs font-bold text-warli-terra">Owner&apos;s reply</p>
                      <p className="text-sm text-gray-700">{question.answer}</p>
                    </div>
                  ) : isOwner ? (
                    <div className="ml-6 flex gap-2">
                      <input
                        type="text"
                        value={answerTexts[question.id] || ''}
                        onChange={(event) =>
                          setAnswerTexts((current) => ({ ...current, [question.id]: event.target.value }))
                        }
                        placeholder="Type your answer..."
                        className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-warli-terra focus:outline-none"
                      />
                      <button
                        onClick={() => handleAnswer(question.id)}
                        disabled={isPending || !answerTexts[question.id]?.trim()}
                        className="rounded-xl bg-warli-terra px-3 py-2 text-sm font-semibold text-warli-cream transition-colors hover:bg-warli-deep disabled:opacity-50"
                      >
                        <Send size={14} />
                      </button>
                    </div>
                  ) : (
                    <p className="ml-6 text-xs italic text-gray-400">No reply yet</p>
                  )}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {isLoggedIn ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={questionText}
            onChange={(event) => setQuestionText(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && handleAsk()}
            placeholder="Ask a question about this business..."
            disabled={isPending}
            className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-warli-terra focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
          />
          <button
            onClick={handleAsk}
            disabled={isPending || !questionText.trim()}
            className="rounded-xl bg-warli-terra px-4 py-2.5 text-sm font-semibold text-warli-cream transition-colors hover:bg-warli-deep disabled:opacity-50"
          >
            Ask
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-warli-sand/60 bg-warli-light/60 px-4 py-5 text-center">
          <p className="mb-3 text-sm text-gray-600">
            Sign in to ask the business owner a question.
          </p>
          <Link
            href={buildAbsoluteUrl(`/login?next=${encodeURIComponent(`/listings/${listingId}`)}`)}
            className="inline-flex items-center gap-2 rounded-xl bg-warli-terra px-4 py-2.5 text-sm font-semibold text-warli-cream transition-colors hover:bg-warli-deep"
          >
            Sign In to Ask
          </Link>
        </div>
      )}

      {submitError ? <p className="mt-1 text-xs text-red-500">{submitError}</p> : null}
      {submitSuccess ? <p className="mt-1 text-xs text-green-600">Question submitted.</p> : null}
    </div>
  )
}
