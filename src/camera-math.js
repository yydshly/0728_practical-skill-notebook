export function computeThirdPersonPose({
  player,
  yaw,
  pitch,
  distance,
  groundY,
}) {
  const target = [player[0], player[1] + 1.45, player[2]];
  const horizontal = Math.cos(pitch) * distance;
  const position = [
    target[0] - Math.sin(yaw) * horizontal,
    Math.max(groundY + 0.65, target[1] - Math.sin(pitch) * distance + 0.6),
    target[2] - Math.cos(yaw) * horizontal,
  ];
  return { target, position };
}
