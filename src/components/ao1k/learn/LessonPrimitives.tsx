/**
 * Ported from Ao1K/Ao1K_site (https://github.com/Ao1K/Ao1K_site).
 * Source: components/learn/LessonBody.tsx, LessonList.tsx, LessonSpan.tsx,
 * LessonStory.tsx, LessonLink.tsx, TitleBar.tsx, LessonTitle.tsx,
 * LessonAudience.tsx.
 *
 * MIT License
 * Copyright (c) 2025 Ao1K
 *
 * Adaptation notes: these are the small presentational building blocks
 * the EO lesson (EoLesson.tsx) is written against. Tailwind utility
 * classes from the originals are replaced with plain class names (this
 * project has no Tailwind dependency); the visual rules for those class
 * names belong to whichever owner wires this lesson into the app's
 * design system (see docs/design-system.md). `next/link`'s <Link> is
 * replaced with a plain anchor.
 */
import type { ReactNode } from 'react'

export function LessonBody({ children }: { children: ReactNode }) {
  return <div className="ao1k-lesson-body">{children}</div>
}

function renderBold(text: string) {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>))
}

export function LessonList({ items, style = 'decimal' }: { items: string[]; style?: 'alpha' | 'decimal' }) {
  return (
    <ol className={`ao1k-lesson-list ao1k-lesson-list--${style === 'alpha' ? 'disc' : 'decimal'}`}>
      {items.map((item, index) => (
        <li key={index}>{renderBold(item)}</li>
      ))}
    </ol>
  )
}

export function S({ span }: { span: string }) {
  return <span className="ao1k-lesson-span">{renderBold(span)}</span>
}

export function LessonStory({ storyParagraphs }: { storyParagraphs: ReactNode[] }) {
  return (
    <div className="ao1k-lesson-story">
      <details>
        <summary>
          <span>Story</span>
        </summary>
        <span className="ao1k-lesson-story__hint">
          The stories are here to make it easier to understand and remember the lessons.
        </span>
      </details>
      {storyParagraphs.map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
    </div>
  )
}

export function LessonLink({ text, href }: { text: string; href: string }) {
  return (
    <span className="ao1k-lesson-link">
      <a href={href} target="_blank" rel="noopener noreferrer">
        {text}
      </a>
    </span>
  )
}

export function LessonTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h1 className="ao1k-lesson-title">{title}</h1>
      {subtitle && <p className="ao1k-lesson-subtitle">{subtitle}</p>}
    </div>
  )
}

function getAudienceColor(seconds: number): string {
  const t = Math.max(0, Math.min(1, (seconds - 10) / 50))
  const r = Math.round(239 + t * (34 - 239))
  const g = Math.round(68 + t * (197 - 68))
  const b = Math.round(68 + t * (94 - 68))
  return `rgb(${r}, ${g}, ${b})`
}

export function LessonAudience({ seconds }: { seconds: number }) {
  const color = getAudienceColor(seconds)

  return (
    <details className="ao1k-lesson-audience">
      <summary>
        <span style={{ color }}>Audience</span>
        <span className="ao1k-lesson-audience__badge" style={{ color, borderColor: color }}>
          Sub-{seconds}
        </span>
      </summary>
      <p>Intended for cubers who average {seconds} seconds or faster.</p>
    </details>
  )
}

export function TitleBar({ title, subtitle, seconds }: { title: string; subtitle?: string; seconds?: number }) {
  return (
    <div className="ao1k-lesson-titlebar">
      <LessonTitle title={title} subtitle={subtitle} />
      {seconds && <LessonAudience seconds={seconds} />}
    </div>
  )
}
