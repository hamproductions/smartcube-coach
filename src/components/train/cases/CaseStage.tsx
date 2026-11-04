import { css } from 'styled-system/css'
import type { AlgorithmRecord } from '../../../domain/models'
import { Cube3D } from '../../solve/Cube3D'
import { CasePreview, isLastLayerSet } from '../../ui/CasePreview'
import type { KPuzzle } from 'cubing/kpuzzle'
import { caseDisplay } from './caseState'
import { useWide } from './hooks'
import { card } from './ui'

export function CaseStage({ record, puzzle, rotation, moves, replay, hideDiagram }: { record: AlgorithmRecord; puzzle: KPuzzle | undefined; rotation: string; moves: string[]; replay?: boolean; hideDiagram?: boolean }) {
  const display = caseDisplay(puzzle, record)
  const setupAlg = [rotation, ...display.setup, ...(replay ? display.replay : moves)].filter(Boolean).join(' ')
  const wide = useWide()
  const showDiagram = !hideDiagram && isLastLayerSet(record.set)
  return (
    <div className={css({ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: { base: '3', md: '6' }, flexWrap: { base: 'nowrap', md: 'wrap' } })}>
      <div aria-label="Case on the cube" role="img" className={css({ display: 'grid', placeItems: 'center' })}>
        <Cube3D size={wide ? 300 : 168} setupAlg={setupAlg} />
      </div>
      {showDiagram && (
        <div aria-label="Case diagram" role="img" className={`${card} ${css({ p: { base: '2', md: '3' }, display: 'grid', placeItems: 'center' })}`}>
          <CasePreview setup={record.setup} set={record.set} size={wide ? 168 : 96} />
        </div>
      )}
    </div>
  )
}
