import type { ComponentType } from 'react'
import { BlindfoldTrainer } from './Blindfold'
import { CasesTrainer } from './Cases'
import { ChecklistTrainer } from './Checklist'
import { CrossGoalTrainer } from './CrossGoal'
import { CrossPlanTrainer } from './CrossPlan'
import { EdgeOrientationTrainer } from './EdgeOrientation'
import { F2lCubeTrainer } from './F2lCube'
import { FreePairTrainer } from './FreePair'
import { HiddenColoursTrainer } from './HiddenColours'
import { PacerTrainer } from './Pacer'
import { PairTrackingTrainer } from './PairTracking'
import { PieceTrackingTrainer } from './PieceTracking'
import { TimeAttackTrainer } from './TimeAttack'

export const TRAINER_VIEWS: Record<string, ComponentType> = {
  'cross-goal': CrossGoalTrainer,
  'cross-plan': CrossPlanTrainer,
  'f2l-cube': F2lCubeTrainer,
  'free-pair': FreePairTrainer,
  cases: CasesTrainer,
  'time-attack': TimeAttackTrainer,
  'pair-tracking': PairTrackingTrainer,
  'piece-tracking': PieceTrackingTrainer,
  'edge-orientation': EdgeOrientationTrainer,
  'hidden-colours': HiddenColoursTrainer,
  pacer: PacerTrainer,
  checklist: ChecklistTrainer,
  blindfold: BlindfoldTrainer
}
