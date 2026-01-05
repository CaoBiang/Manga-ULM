import type { ReactNode } from 'react'

export type GlassSurfaceProps = {
  title?: ReactNode
  subtitle?: ReactNode
  extra?: ReactNode
  variant?: 'panel' | 'card' | 'plain'
  padding?: 'none' | 'sm' | 'md' | 'lg'
  children: ReactNode
}

export default function GlassSurface({
  title,
  subtitle,
  extra,
  variant = 'panel',
  padding = 'md',
  children
}: GlassSurfaceProps) {
  const hasHeader = Boolean(title || subtitle || extra)

  return (
    <section className={`glass-surface glass-surface--${variant} glass-surface--pad-${padding}`}>
      {hasHeader ? (
        <header className="glass-surface__header">
          <div className="glass-surface__heading">
            <div className="glass-surface__title-row">
              {typeof title === 'string' ? <h3 className="glass-surface__title">{title}</h3> : title}
              {extra}
            </div>
            {typeof subtitle === 'string' ? <p className="glass-surface__subtitle">{subtitle}</p> : subtitle}
          </div>
        </header>
      ) : null}
      <div className="glass-surface__body">{children}</div>
    </section>
  )
}

