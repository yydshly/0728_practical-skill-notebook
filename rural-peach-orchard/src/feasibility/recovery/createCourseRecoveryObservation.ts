import type { OrchardWorldDefinition } from '../world/orchardWorldDefinition'
import type { RecoveryObservation } from './RecoveryManager'

type RecoveryObservationInput = Omit<RecoveryObservation, 'floorY'>

export function createCourseRecoveryObservation(
  course: Pick<OrchardWorldDefinition, 'gameplayPlaneY'>,
  input: RecoveryObservationInput,
): RecoveryObservation {
  return {
    ...input,
    floorY: course.gameplayPlaneY - 0.2,
  }
}
