import { useState, type ImgHTMLAttributes } from 'react'
import './safe-image.css'

export interface SafeImageProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'alt' | 'onError' | 'src'> {
  readonly src: string
  readonly alt: string
  readonly fallbackLabel?: string
}

function classes(...values: Array<string | undefined>): string {
  return values.filter((value) => value !== undefined && value !== '').join(' ')
}

export function SafeImage({
  src,
  alt,
  fallbackLabel,
  className,
  loading = 'lazy',
  decoding = 'async',
  ...imageProps
}: SafeImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  if (failedSrc !== src) {
    return (
      <img
        {...imageProps}
        src={src}
        alt={alt}
        loading={loading}
        decoding={decoding}
        className={classes('safe-image', className)}
        onError={() => setFailedSrc(src)}
      />
    )
  }

  return (
    <span
      className={classes('safe-image', 'safe-image--fallback', className)}
      role={alt === '' ? undefined : 'img'}
      aria-label={alt === '' ? undefined : alt}
      aria-hidden={alt === '' ? true : undefined}
    >
      <span className="safe-image__geometry" aria-hidden="true" />
      <span className="safe-image__fallback-label">
        {fallbackLabel ?? (alt === '' ? 'Image unavailable' : alt)}
      </span>
    </span>
  )
}
