type MobileContactBarProps = {
  phoneHref: string | null
  enquiryLink: string | null
  directionsUrl: string | null
  hasSiteTabs: boolean
}

export default function MobileContactBar({
  phoneHref,
  enquiryLink,
  directionsUrl,
  hasSiteTabs,
}: MobileContactBarProps) {
  if (!phoneHref && !enquiryLink && !directionsUrl) return null

  return (
    <div
      data-mobile-bottom-chrome
      className="fixed inset-x-0 z-40 px-3 md:hidden"
      style={{
        bottom: hasSiteTabs
          ? 'calc(4rem + env(safe-area-inset-bottom, 0px))'
          : 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="mx-auto flex max-w-md gap-2 rounded-2xl border border-border/70 bg-white/95 p-2 shadow-lg backdrop-blur-sm">
        {phoneHref && (
          <a href={`tel:${phoneHref}`} className="flex flex-1 items-center justify-center rounded-xl bg-brand px-3 py-3 text-sm font-semibold text-white">
            Call
          </a>
        )}
        {enquiryLink && (
          <a href={enquiryLink} target="_blank" rel="noopener noreferrer" className="flex flex-1 items-center justify-center rounded-xl bg-green-600 px-3 py-3 text-sm font-semibold text-white">
            WhatsApp
          </a>
        )}
        {directionsUrl && (
          <a href={directionsUrl} target="_blank" rel="noopener noreferrer" className="flex flex-1 items-center justify-center rounded-xl border border-border px-3 py-3 text-sm font-semibold text-ink">
            Map
          </a>
        )}
      </div>
    </div>
  )
}
