export function floatingPanelBottomClasses(): string {
  return 'bottom-[calc(5rem+env(safe-area-inset-bottom))] lg:bottom-6'
}

export function paymentRecoveryBottom(hasBottomChrome: boolean): string {
  return hasBottomChrome
    ? 'calc(4.5rem + env(safe-area-inset-bottom, 0px))'
    : 'calc(1rem + env(safe-area-inset-bottom, 0px))'
}
