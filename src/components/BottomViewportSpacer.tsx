type BottomViewportSpacerProps = {
  until: 'md' | 'lg'
}

export default function BottomViewportSpacer({ until }: BottomViewportSpacerProps) {
  const breakpoint = until === 'md' ? 'md:hidden' : 'lg:hidden'

  return (
    <div
      aria-hidden="true"
      className={`h-[calc(4rem+env(safe-area-inset-bottom,0px))] shrink-0 ${breakpoint}`}
    />
  )
}
