import type { ReactNode } from 'react'

export type GlassPageProps = {
  title?: string
  subtitle?: string
  extra?: ReactNode
  padding?: 'sm' | 'md' | 'lg'
  children: ReactNode
}

export default function GlassPage({ title = '', subtitle = '', extra, padding = 'md', children }: GlassPageProps) {
  const hasHeader = Boolean(title || subtitle || extra)

  return (
    <div className={`glass-page glass-page--pad-${padding}`}>
      {hasHeader ? (
        <div className="glass-page__header">
          {title || subtitle ? (
            <div className="glass-page__heading">
              {title ? <h1 className="glass-page__title">{title}</h1> : null}
              {subtitle ? <p className="glass-page__subtitle">{subtitle}</p> : null}
            </div>
          ) : null}
          {extra ? <div className="glass-page__extra">{extra}</div> : null}
        </div>
      ) : null}

      <div className="glass-page__content">{children}</div>
    </div>
  )
}

