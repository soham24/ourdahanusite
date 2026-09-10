'use client'

import { useState, useTransition } from 'react'
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react'
import { deleteListing } from '@/app/actions/admin'

interface Props {
  id: string
  name: string
}

export default function DeleteListingButton({ id, name }: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleDelete = () => {
    const fd = new FormData()
    fd.set('id', id)
    startTransition(async () => {
      await deleteListing(fd)
      // Hard reload so the server component re-fetches fresh data
      window.location.reload()
    })
  }

  return (
    <>
      {/* Delete trigger button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold px-3 py-2 rounded-lg transition-colors border border-red-100"
      >
        <Trash2 size={13} /> Delete
      </button>

      {/* Confirmation dialog */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !isPending && setOpen(false)}
          />

          {/* Dialog */}
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 flex flex-col items-center text-center">
            {isPending ? (
              <>
                <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
                  <Loader2 size={28} className="text-red-500 animate-spin" />
                </div>
                <h2 className="text-lg font-bold text-gray-900 mb-1">Deleting…</h2>
                <p className="text-sm text-gray-500">Please wait while the listing is being removed.</p>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
                  <AlertTriangle size={28} className="text-red-500" />
                </div>
                <h2 className="text-lg font-bold text-gray-900 mb-1">Delete listing?</h2>
                <p className="text-sm text-gray-500 mb-1">
                  You are about to permanently delete:
                </p>
                <p className="text-sm font-semibold text-gray-800 mb-5 px-2 truncate max-w-full">
                  &ldquo;{name}&rdquo;
                </p>
                <p className="text-xs text-gray-400 mb-6">This action cannot be undone.</p>

                <div className="flex gap-3 w-full">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors"
                  >
                    Yes, Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
