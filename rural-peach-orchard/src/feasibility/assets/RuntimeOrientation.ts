import { Quaternion, Vector3 } from 'three'

export interface RuntimeOrientation {
  readonly upAxis: 'Y'
  readonly forwardAxis: '-Z'
  readonly localUp: Readonly<Vector3>
  readonly localForward: Readonly<Vector3>
}

export function createRuntimeOrientation(
  input: Readonly<{ upAxis: 'Y'; forwardAxis: '-Z' }>,
): RuntimeOrientation {
  return Object.freeze({
    upAxis: input.upAxis,
    forwardAxis: input.forwardAxis,
    localUp: Object.freeze(new Vector3(0, 1, 0)),
    localForward: Object.freeze(new Vector3(0, 0, -1)),
  })
}

export function worldForward(
  orientation: RuntimeOrientation,
  rotation: Readonly<Quaternion>,
  target: Vector3 = new Vector3(),
): Vector3 {
  return target.copy(orientation.localForward).applyQuaternion(rotation)
}
