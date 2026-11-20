import { useEffect, useState } from 'react'
import { css, cx } from 'styled-system/css'
import { navigate, routeHref } from '../../../app/route'
import { clearPlanHandoff, setPlanHandoff } from '../../../coaching/handoff'
import { PLAN, drillProgress, presetCaseIds, startOfToday, type PlanDrill } from '../../../coaching/plan'
import type { TrainerAttempt } from '../../../domain/models'
import { repositories } from '../../../storage/database'
import { PageHeader, Section, card, mono, pageFrame, secondaryButton } from '../../ui/Page'
import { writeChoice, writeIdList } from '../f2l/remember'
import { trainerById } from '../trainers'

const caseLabel = (id: string) => {
  const name = id.replace(/^(pll|oll|f2l-stuck-edge)-/, '')
  return id.startsWith('pll-') ? name.charAt(0).toUpperCase() + name.slice(1) : String(Number(name))
}

async function launch(drill: PlanDrill) {
  const preset = drill.preset
  clearPlanHandoff()
  if (preset?.kind === 'cases') {
    await repositories.settings.put({ key: 'trainer-cases', value: { set: preset.set, subset: 'All', learning: 'All', mode: preset.mode, chosen: true } })
    setPlanHandoff({ trainer: 'cases', caseIds: preset.ids })
  }
  if (preset?.kind === 'time-attack') {
    const stored = await repositories.settings.get('trainer-time-attack')
    const previous = stored && typeof stored.value === 'object' && stored.value ? stored.value : {}
    await repositories.settings.put({ key: 'trainer-time-attack', value: { ...previous, set: preset.set, order: preset.ids } })
  }
  if (preset?.kind === 'f2l') {
    writeIdList('f2l-cube:cases', preset.ids)
    writeChoice('f2l-cube:order', 'slow')
  }
  if (preset?.kind === 'cross-goal') setPlanHandoff({ trainer: 'cross-goal', pairs: preset.pairs })
  navigate({ section: 'train', detail: drill.trainer })
}

function DrillCard({ drill, attempts, since }: { drill: PlanDrill; attempts: TrainerAttempt[]; since: number }) {
  const [starting, setStarting] = useState(false)
  const trainer = trainerById(drill.trainer)
  const progress = drillProgress(drill, attempts, since)
  const ids = presetCaseIds(drill)
  const start = () => {
    setStarting(true)
    void launch(drill).catch(() => navigate({ section: 'train', detail: drill.trainer }))
  }
  return (
    <article className={cx(card, css({ p: { base: '4', md: '5' }, display: 'flex', flexDirection: 'column', gap: '3' }))}>
      <div className={css({ display: 'flex', flexDirection: 'column', gap: '1' })}>
        <h3 className={css({ fontSize: 'md', fontWeight: 'semibold' })}>{drill.title}</h3>
        <p className={css({ fontSize: 'sm', color: 'inkVariant', lineHeight: '1.5' })}>{drill.problem}</p>
      </div>
      <ol className={css({ display: 'flex', flexDirection: 'column', gap: '1', pl: '5', fontSize: 'sm', lineHeight: '1.6', listStyleType: 'decimal' })}>
        {drill.steps.map((step) => <li key={step}>{step}</li>)}
      </ol>
      {drill.counts && <p className={css({ fontSize: 'sm', lineHeight: '1.6', pl: '3', borderLeftWidth: '2px', borderColor: 'green' })}>{drill.counts}</p>}
      {ids.length > 0 && ids.length <= 12 && (
        <ul aria-label="Cases in this drill" className={css({ display: 'flex', flexWrap: 'wrap', gap: '1.5', listStyle: 'none', p: '0', m: '0' })}>
          {ids.map((id) => {
            const clean = progress?.cleanCases.has(id) ?? false
            return (
              <li key={id} title={clean ? 'Solved clean today' : 'Not done today'} className={cx(mono, css({ minW: '9', px: '2', py: '1', textAlign: 'center', fontSize: 'sm', borderRadius: 'control', borderWidth: '1px', borderColor: clean ? 'green' : 'floating', color: clean ? 'ink' : 'inkVariant', bg: clean ? 'floating' : 'transparent' }))}>
                {caseLabel(id)}
              </li>
            )
          })}
        </ul>
      )}
      <div className={css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '3', mt: 'auto' })}>
        <button type="button" className={secondaryButton} disabled={starting} onClick={start}>Start in {trainer?.name ?? 'trainer'}</button>
        {progress && (
          <span className={cx(mono, css({ fontSize: 'sm', color: progress.clean ? 'ink' : 'inkVariant' }))}>
            {progress.reps ? `${progress.clean} clean of ${progress.reps} today` : 'Not started today'}
          </span>
        )}
      </div>
    </article>
  )
}

export function PlanPage() {
  const [attempts, setAttempts] = useState<TrainerAttempt[]>([])
  const since = startOfToday()
  useEffect(() => {
    void repositories.attempts.all().then(setAttempts).catch(() => undefined)
  }, [])
  return (
    <div className={pageFrame}>
      <PageHeader title="Your plan" description="Built from your last 1000 solves. Each drill opens its trainer already set to your weak cases, and the cube counts the reps.">
        <a href={routeHref({ section: 'train' })} className={css({ display: 'inline-flex', alignItems: 'center', alignSelf: 'flex-start', minH: '44px', fontSize: 'sm', color: 'inkVariant', textDecoration: 'none', _hover: { color: 'ink' } })}>All training</a>
      </PageHeader>
      {PLAN.map((group) => (
        <Section key={group.id} id={`plan-${group.id}`} title={group.title} description={group.problem}>
          <div className={css({ display: 'grid', gap: '3', gridTemplateColumns: { base: '1fr', md: 'repeat(2, minmax(0, 1fr))' } })}>
            {group.drills.map((drill) => <DrillCard key={drill.id} drill={drill} attempts={attempts} since={since} />)}
          </div>
        </Section>
      ))}
      <div className={css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '3' })}>
        <span className={css({ fontSize: 'sm', color: 'inkVariant' })}>Finish with twelve normal timed solves.</span>
        <a href={routeHref({ section: 'solve' })} className={secondaryButton}>Open Solve</a>
      </div>
    </div>
  )
}
