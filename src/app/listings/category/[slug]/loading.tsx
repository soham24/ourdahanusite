export default function ListingCategoryLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="h-10 w-72 rounded-xl bg-gray-100" />
      <div className="mt-3 h-5 w-96 rounded-lg bg-gray-100" />
      <div className="mt-8 h-14 rounded-xl bg-gray-100" />
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-64 rounded-2xl bg-gray-100" />
        ))}
      </div>
    </div>
  )
}
