import Link from 'next/link'

export default function ForumPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-7xl mb-6">💬</div>
        <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-700 font-semibold text-sm px-4 py-1.5 rounded-full mb-4">
          <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse inline-block" />
          Coming Soon
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Community Forum</h1>
        <p className="text-gray-500 text-base leading-relaxed mb-8">
          A place for Dahanu residents to discuss, help each other, and stay connected. Coming soon!
        </p>
        <Link href="/" className="inline-flex items-center gap-2 bg-brand hover:bg-brand-strong text-bg font-semibold px-6 py-3 rounded-xl transition-colors">
          Back to Home
        </Link>
      </div>
    </div>
  )
}
