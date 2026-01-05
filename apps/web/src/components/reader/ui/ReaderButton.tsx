import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ReaderButtonAppearance = 'floating' | 'embedded'
type ReaderButtonVariant = 'default' | 'primary' | 'danger' | 'ghost'
type ReaderButtonSize = 'sm' | 'md' | 'lg'
type ReaderButtonShape = '' | 'circle' | 'round'

export type ReaderButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> & {
  appearance?: ReaderButtonAppearance
  variant?: ReaderButtonVariant
  size?: ReaderButtonSize
  shape?: ReaderButtonShape
  active?: boolean
  ariaLabel?: string
  nativeType?: 'button' | 'submit' | 'reset'
  icon?: ReactNode
}

const joinClass = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ')

export default function ReaderButton({
  appearance = 'floating',
  variant = 'default',
  size = 'md',
  shape = '',
  active = false,
  disabled = false,
  ariaLabel = '',
  nativeType = 'button',
  icon,
  className,
  children,
  onClick,
  ...rest
}: ReaderButtonProps) {
  const hasIcon = Boolean(icon)
  const hasText = Boolean(children)
  const isIconOnly = hasIcon && !hasText

  const resolvedAriaLabel = isIconOnly ? (ariaLabel.trim() ? ariaLabel.trim() : undefined) : (rest['aria-label'] as any)

  return (
    <button
      {...rest}
      type={nativeType}
      disabled={disabled}
      aria-label={resolvedAriaLabel}
      className={joinClass(
        'reader-button',
        `reader-button--appearance-${appearance}`,
        `reader-button--${variant}`,
        `reader-button--${size}`,
        shape ? `reader-button--${shape}` : '',
        active ? 'is-active' : '',
        isIconOnly ? 'is-icon-only' : '',
        className
      )}
      onClick={(event) => {
        if (disabled) {
          event.preventDefault()
          return
        }
        onClick?.(event)
      }}
    >
      {hasIcon ? <span className="reader-button__icon">{icon}</span> : null}
      {hasText ? <span className="reader-button__text">{children}</span> : null}
    </button>
  )
}

