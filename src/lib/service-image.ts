export type ServiceImageAspect = 'square' | 'landscape' | 'portrait'

type ServiceImageAspectOption = {
  value: ServiceImageAspect
  label: string
  shortLabel: string
  aspectRatio: number
  cssAspectRatio: string
  outputWidth: number
  outputHeight: number
  thumbnailWidth: number
  thumbnailHeight: number
}

const SERVICE_IMAGE_ASPECT_CONFIG: Record<ServiceImageAspect, ServiceImageAspectOption> = {
  square: {
    value: 'square',
    label: 'Square',
    shortLabel: '1:1',
    aspectRatio: 1,
    cssAspectRatio: '1 / 1',
    outputWidth: 800,
    outputHeight: 800,
    thumbnailWidth: 64,
    thumbnailHeight: 64,
  },
  landscape: {
    value: 'landscape',
    label: 'Horizontal',
    shortLabel: '4:3',
    aspectRatio: 4 / 3,
    cssAspectRatio: '4 / 3',
    outputWidth: 960,
    outputHeight: 720,
    thumbnailWidth: 80,
    thumbnailHeight: 60,
  },
  portrait: {
    value: 'portrait',
    label: 'Vertical',
    shortLabel: '3:4',
    aspectRatio: 3 / 4,
    cssAspectRatio: '3 / 4',
    outputWidth: 720,
    outputHeight: 960,
    thumbnailWidth: 60,
    thumbnailHeight: 80,
  },
}

export const DEFAULT_SERVICE_IMAGE_ASPECT: ServiceImageAspect = 'landscape'
export const NEW_SERVICE_IMAGE_ASPECT: ServiceImageAspect = 'square'

export const SERVICE_IMAGE_ASPECT_OPTIONS = Object.values(SERVICE_IMAGE_ASPECT_CONFIG)

export function isServiceImageAspect(value: unknown): value is ServiceImageAspect {
  return value === 'square' || value === 'landscape' || value === 'portrait'
}

export function normalizeServiceImageAspect(
  value: unknown,
  fallback: ServiceImageAspect = DEFAULT_SERVICE_IMAGE_ASPECT,
): ServiceImageAspect {
  return isServiceImageAspect(value) ? value : fallback
}

export function getServiceImageAspectOption(
  value: unknown,
  fallback: ServiceImageAspect = DEFAULT_SERVICE_IMAGE_ASPECT,
): ServiceImageAspectOption {
  return SERVICE_IMAGE_ASPECT_CONFIG[normalizeServiceImageAspect(value, fallback)]
}
