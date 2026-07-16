import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function Pagination({
  page,
  pageSize,
  total,
  hrefFor,
}: {
  page: number
  pageSize: number
  total: number
  hrefFor: (page: number) => string
}) {
  if (total === 0) return null

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  return (
    <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
      <span>Showing {start}–{end} of {total}</span>
      <div className="flex gap-2">
        <Link
          href={hrefFor(Math.max(1, page - 1))}
          aria-disabled={page <= 1}
          className={`inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 ${
            page <= 1 ? 'pointer-events-none opacity-40' : 'hover:bg-gray-50'
          }`}
        >
          <ChevronLeft size={14} /> Prev
        </Link>
        <Link
          href={hrefFor(Math.min(totalPages, page + 1))}
          aria-disabled={page >= totalPages}
          className={`inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 ${
            page >= totalPages ? 'pointer-events-none opacity-40' : 'hover:bg-gray-50'
          }`}
        >
          Next <ChevronRight size={14} />
        </Link>
      </div>
    </div>
  )
}
