import { useEffect, useRef, useState } from 'react'
import { css } from 'styled-system/css'
import { subscribeResolvedMoves } from '../../device/CubeConnection'
import { isSolvedPattern } from '../../domain/scramble'
import { useRoutedScramble } from './useRoutedScramble'

export type CubeScrambleState = 'scrambling' | 'scrambled' | 'solved'

export function CubeScramble({ target, onState }: { target: string; onState?: (state: CubeScrambleState) => void }) {
  const { scramble, generate, follow } = useRoutedScramble()
  const [state, setState] = useState<CubeScrambleState>('scrambling')
  const stateRef = useRef(state)
  const report = useRef(onState)
  report.current = onState

  useEffect(() => {
    stateRef.current = 'scrambling'
    setState('scrambling')
    void generate(target)
  }, [target, generate])

  useEffect(() => subscribeResolvedMoves((resolved) => {
    if (stateRef.current === 'scrambling') {
      if (follow(resolved.pattern)?.complete) {
        stateRef.current = 'scrambled'
        setState('scrambled')
        report.current?.('scrambled')
      }
      return
    }
    if (stateRef.current === 'scrambled') {
      void isSolvedPattern(resolved.pattern).then((solved) => {
        if (!solved || stateRef.current !== 'scrambled') return
        stateRef.current = 'solved'
        setState('solved')
        report.current?.('solved')
      }).catch(() => undefined)
    }
  }), [follow])

  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '2', alignItems: 'center' })}>
      <p aria-label="Scramble" className={css({ fontFamily: 'mono', fontSize: { base: '18px', md: '22px' }, lineHeight: '1.5', textAlign: 'center', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: '2' })}>
        {scramble ? scramble.moves.map((move, index) => (
          <span key={`${move}-${index}`} className={css({ opacity: state !== 'scrambling' || index < scramble.done ? '0.3' : '1', color: state === 'scrambling' && index === scramble.done && !scramble.offTrack ? 'green' : 'ink' })}>{move}</span>
        )) : <span className={css({ color: 'inkVariant', fontSize: 'md' })}>Working out the turns from your cube...</span>}
      </p>
      <p role="status" className={css({ fontSize: 'sm', color: scramble?.offTrack && state === 'scrambling' ? 'amber' : state === 'scrambling' ? 'inkVariant' : 'green' })}>
        {state === 'scrambling' ? (scramble?.offTrack ? 'Off the scramble. Undo the last turn.' : 'Turn this from where your cube is.') : state === 'scrambled' ? 'Scrambled. Your cube is ready.' : 'Solved.'}
      </p>
    </div>
  )
}
