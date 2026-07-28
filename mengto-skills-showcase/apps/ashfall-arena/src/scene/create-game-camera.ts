import { PerspectiveCamera, Vector3 } from "three";

interface CameraBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

interface GameCameraOptions {
  bounds?: CameraBounds;
  targetOffset?: Vector3;
  positionOffset?: Vector3;
  minimumDistance?: number;
  resolveDistance?: (
    target: Readonly<Vector3>,
    desiredPosition: Readonly<Vector3>,
  ) => number;
  reducedMotion?: boolean;
}

export interface GameCameraDiagnostics {
  target: Vector3;
  position: Vector3;
  distance: number;
  lockFraming: boolean;
  reducedMotion: boolean;
  shakeAmplitude: number;
}

export interface GameCameraController {
  snapTo(player: Readonly<Vector3>): void;
  update(player: Readonly<Vector3>, deltaSeconds: number): void;
  setLockTarget(target: Readonly<Vector3> | null): void;
  setReducedMotion(reduced: boolean): void;
  shake(amplitude: number, duration: number): {
    amplitude: number;
    duration: number;
  };
  getDiagnostics(): GameCameraDiagnostics;
  dispose(): void;
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export function createGameCamera(
  camera: PerspectiveCamera,
  options: GameCameraOptions = {},
): GameCameraController {
  const bounds = options.bounds ?? {
    minX: -18,
    maxX: 18,
    minZ: -12,
    maxZ: 12,
  };
  const targetOffset = options.targetOffset?.clone() ?? new Vector3(0, 1.05, 0.85);
  const positionOffset = options.positionOffset?.clone() ?? new Vector3(7.8, 9.4, 9.8);
  const minimumDistance = options.minimumDistance ?? 5.5;
  const currentTarget = new Vector3();
  const desiredTarget = new Vector3();
  const currentPosition = new Vector3();
  const desiredPosition = new Vector3();
  const workingDirection = new Vector3();
  let lockTarget: Vector3 | null = null;
  let reducedMotion = options.reducedMotion ?? false;
  let shakeAmplitude = 0;
  let shakeDuration = 0;
  let shakeElapsed = 0;
  let disposed = false;

  const assertLive = () => {
    if (disposed) throw new Error("Game camera is disposed");
  };

  const compute = (player: Readonly<Vector3>) => {
    const playerCenter = new Vector3(
      clamp(player.x, bounds.minX, bounds.maxX),
      player.y,
      clamp(player.z, bounds.minZ, bounds.maxZ),
    );
    if (lockTarget) {
      desiredTarget.copy(playerCenter).add(lockTarget).multiplyScalar(0.5);
    } else {
      desiredTarget.copy(playerCenter);
    }
    desiredTarget.add(targetOffset);
    desiredTarget.x = clamp(desiredTarget.x, bounds.minX, bounds.maxX);
    desiredTarget.z = clamp(desiredTarget.z, bounds.minZ, bounds.maxZ);

    let distanceScale = 1;
    if (lockTarget) {
      distanceScale += Math.min(0.34, playerCenter.distanceTo(lockTarget) * 0.035);
    }
    desiredPosition
      .copy(desiredTarget)
      .addScaledVector(positionOffset, distanceScale);
    const requestedDistance =
      options.resolveDistance?.(desiredTarget, desiredPosition) ??
      desiredPosition.distanceTo(desiredTarget);
    const safeDistance = Math.max(
      minimumDistance,
      Math.min(
        desiredPosition.distanceTo(desiredTarget),
        Number.isFinite(requestedDistance)
          ? requestedDistance
          : desiredPosition.distanceTo(desiredTarget),
      ),
    );
    workingDirection
      .copy(desiredPosition)
      .sub(desiredTarget)
      .normalize()
      .multiplyScalar(safeDistance);
    desiredPosition.copy(desiredTarget).add(workingDirection);
  };

  const applyView = () => {
    camera.position.copy(currentPosition);
    if (!reducedMotion && shakeDuration > 0 && shakeElapsed < shakeDuration) {
      const fade = 1 - shakeElapsed / shakeDuration;
      camera.position.x += Math.sin(shakeElapsed * 91) * shakeAmplitude * fade;
      camera.position.y += Math.cos(shakeElapsed * 77) * shakeAmplitude * 0.55 * fade;
    }
    camera.lookAt(currentTarget);
    camera.updateMatrixWorld();
  };

  return {
    snapTo(player) {
      assertLive();
      compute(player);
      currentTarget.copy(desiredTarget);
      currentPosition.copy(desiredPosition);
      applyView();
    },
    update(player, deltaSeconds) {
      assertLive();
      const delta = clamp(
        Number.isFinite(deltaSeconds) ? deltaSeconds : 0,
        0,
        0.1,
      );
      compute(player);
      const targetSpeed = reducedMotion ? 28 : 12;
      const positionSpeed = reducedMotion ? 24 : 8;
      currentTarget.lerp(desiredTarget, 1 - Math.exp(-targetSpeed * delta));
      currentPosition.lerp(
        desiredPosition,
        1 - Math.exp(-positionSpeed * delta),
      );
      workingDirection.copy(currentPosition).sub(currentTarget);
      if (workingDirection.length() < minimumDistance) {
        if (workingDirection.lengthSq() < 1e-8) {
          workingDirection.copy(positionOffset);
        }
        currentPosition
          .copy(currentTarget)
          .add(workingDirection.normalize().multiplyScalar(minimumDistance));
      }
      shakeElapsed += delta;
      if (shakeElapsed >= shakeDuration) {
        shakeAmplitude = 0;
        shakeDuration = 0;
        shakeElapsed = 0;
      }
      applyView();
    },
    setLockTarget(target) {
      assertLive();
      lockTarget = target ? new Vector3(target.x, target.y, target.z) : null;
    },
    setReducedMotion(reduced) {
      assertLive();
      reducedMotion = reduced;
      if (reduced) {
        shakeAmplitude = 0;
        shakeDuration = 0;
        shakeElapsed = 0;
      }
    },
    shake(amplitude, duration) {
      assertLive();
      if (reducedMotion) return { amplitude: 0, duration: 0 };
      shakeAmplitude = clamp(amplitude, 0, 0.24);
      shakeDuration = clamp(duration, 0, 0.45);
      shakeElapsed = 0;
      return { amplitude: shakeAmplitude, duration: shakeDuration };
    },
    getDiagnostics() {
      assertLive();
      return {
        target: currentTarget.clone(),
        position: camera.position.clone(),
        distance: camera.position.distanceTo(currentTarget),
        lockFraming: lockTarget !== null,
        reducedMotion,
        shakeAmplitude,
      };
    },
    dispose() {
      disposed = true;
      lockTarget = null;
    },
  };
}
