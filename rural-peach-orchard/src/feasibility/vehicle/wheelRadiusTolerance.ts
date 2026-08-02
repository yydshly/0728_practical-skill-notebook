export const WHEEL_RADIUS_TOLERANCE_M = 0.02

const FLOAT32_MEASUREMENT_EPSILON_M = 1e-6

export function isWheelRadiusWithinTolerance(
  measuredRadiusM: number,
  declaredRadiusM: number,
): boolean {
  return Number.isFinite(measuredRadiusM)
    && Number.isFinite(declaredRadiusM)
    && Math.abs(measuredRadiusM - declaredRadiusM)
      <= WHEEL_RADIUS_TOLERANCE_M + FLOAT32_MEASUREMENT_EPSILON_M
}
