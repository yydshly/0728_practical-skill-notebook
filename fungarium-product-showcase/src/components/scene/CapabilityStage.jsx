import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { MathUtils } from "three";
import { CAPABILITIES } from "../../config/showcaseConfig";
import { shelfXFor, stagePosition } from "../../scene/stageMath";
import { useShowcaseStore } from "../../state/useShowcaseStore";
import { CapabilityArtifact } from "./CapabilityArtifact";

export function CapabilityStage({ onGrabChange }) {
  const artifactRef = useRef();
  const progressRef = useRef(0);
  const angularVelocityRef = useRef(0);
  const dragRef = useRef({
    active: false,
    pointerId: null,
    lastX: 0,
    lastTime: 0,
  });

  const selectedIndex = useShowcaseStore((state) => state.selectedIndex);
  const turnNonce = useShowcaseStore((state) => state.turnNonce);
  const capability = CAPABILITIES[selectedIndex];
  const fromX = shelfXFor(selectedIndex, CAPABILITIES.length);

  useEffect(() => {
    progressRef.current = 0;
    angularVelocityRef.current = 0;
    dragRef.current.active = false;
    onGrabChange(false);

    if (artifactRef.current) {
      artifactRef.current.position.set(...stagePosition(0, fromX));
    }
  }, [fromX, onGrabChange, selectedIndex, turnNonce]);

  useEffect(() => () => onGrabChange(false), [onGrabChange]);

  useFrame((_, delta) => {
    const artifact = artifactRef.current;
    if (!artifact) return;

    progressRef.current = MathUtils.damp(progressRef.current, 1, 4.8, delta);
    if (1 - progressRef.current < 0.001) progressRef.current = 1;
    artifact.position.set(...stagePosition(progressRef.current, fromX));

    if (!dragRef.current.active) {
      angularVelocityRef.current *= Math.exp(-4.2 * delta);
      if (Math.abs(angularVelocityRef.current) < 0.015) {
        angularVelocityRef.current = 0;
      }
      artifact.rotation.y += (angularVelocityRef.current + 0.16) * delta;
      artifact.rotation.x = MathUtils.damp(artifact.rotation.x, 0, 3.5, delta);
    }
  });

  const release = (event) => {
    if (!dragRef.current.active) return;
    if (
      event.pointerId !== undefined &&
      dragRef.current.pointerId !== null &&
      event.pointerId !== dragRef.current.pointerId
    ) {
      return;
    }

    event.stopPropagation();
    dragRef.current.active = false;
    dragRef.current.pointerId = null;
    onGrabChange(false);
  };

  return (
    <CapabilityArtifact
      key={capability.id}
      ref={artifactRef}
      capability={capability}
      name={`active-${capability.id}`}
      scale={0.88}
      onPointerDown={(event) => {
        event.stopPropagation();
        event.target.setPointerCapture?.(event.pointerId);
        dragRef.current = {
          active: true,
          pointerId: event.pointerId,
          lastX: event.clientX,
          lastTime: performance.now(),
        };
        angularVelocityRef.current = 0;
        onGrabChange(true);
      }}
      onPointerMove={(event) => {
        if (
          !dragRef.current.active ||
          event.pointerId !== dragRef.current.pointerId ||
          !artifactRef.current
        ) {
          return;
        }

        event.stopPropagation();
        const now = performance.now();
        const elapsed = Math.max((now - dragRef.current.lastTime) / 1000, 1 / 240);
        const deltaX = event.clientX - dragRef.current.lastX;
        const turn = deltaX * 0.01;

        artifactRef.current.rotation.y += turn;
        angularVelocityRef.current = MathUtils.clamp(turn / elapsed, -8, 8);
        dragRef.current.lastX = event.clientX;
        dragRef.current.lastTime = now;
      }}
      onPointerUp={release}
      onPointerCancel={release}
    />
  );
}
