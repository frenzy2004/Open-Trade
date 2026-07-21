import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SafeImage } from './SafeImage'

describe('SafeImage', () => {
  it('renders the requested image and preserves its alt text', () => {
    render(<SafeImage src="/valid.webp" alt="Trading draft room" />)

    expect(screen.getByRole('img', { name: 'Trading draft room' })).toHaveAttribute(
      'src',
      '/valid.webp',
    )
  })

  it('replaces a failed request with an accessible code-rendered fallback', () => {
    render(
      <SafeImage
        src="/missing.webp"
        alt="Founder boardroom"
        fallbackLabel="Boardroom art unavailable"
        className="hero-art"
      />,
    )

    fireEvent.error(screen.getByRole('img', { name: 'Founder boardroom' }))

    const fallback = screen.getByRole('img', { name: 'Founder boardroom' })
    expect(fallback).toHaveClass('safe-image--fallback', 'hero-art')
    expect(fallback).toHaveTextContent('Boardroom art unavailable')
    expect(screen.queryByText('/missing.webp')).not.toBeInTheDocument()
  })

  it('tries again when the source changes after a failure', () => {
    const view = render(<SafeImage src="/first.webp" alt="Runner street" />)
    fireEvent.error(screen.getByRole('img', { name: 'Runner street' }))

    view.rerender(<SafeImage src="/second.webp" alt="Runner street" />)

    expect(screen.getByRole('img', { name: 'Runner street' })).toHaveAttribute(
      'src',
      '/second.webp',
    )
  })

  it('keeps decorative fallback output hidden from assistive technology', () => {
    const { container } = render(<SafeImage src="/missing.webp" alt="" />)
    fireEvent.error(container.querySelector('img') as HTMLImageElement)

    expect(container.querySelector('[aria-hidden="true"]')).toHaveClass(
      'safe-image--fallback',
    )
    expect(container.querySelector('[role="img"]')).toBeNull()
  })
})
