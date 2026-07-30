const profiles = {
  player: {
    scale: 1, lean: 0.02, leftArmLength: 0.72, rightArmLength: 0.72,
    colors: { coat: 0x506755, trousers: 0x2d3630, skin: 0xb98568 },
  },
  resident: {
    scale: 0.96, lean: 0.14, leftArmLength: 0.68, rightArmLength: 0.68,
    colors: { coat: 0x765852, trousers: 0x403b39, skin: 0xb17f65 },
  },
  mutant: {
    scale: 1.08, lean: 0.34, leftArmLength: 0.92, rightArmLength: 0.76,
    colors: { coat: 0x4d4540, trousers: 0x292d29, skin: 0x819077 },
  },
};

export function getCharacterProfile(kind) {
  return structuredClone(profiles[kind] ?? profiles.resident);
}

export function getGaitPose(time, speed, kind) {
  const phase = time * (kind === 'mutant' ? 8.2 : 6.8);
  const amount = Math.min(speed / 3.6, 1) * (kind === 'mutant' ? 0.72 : 0.52);
  const swing = Math.sin(phase) * amount;
  return {
    leftArm: swing,
    rightArm: -swing,
    leftLeg: -swing,
    rightLeg: swing,
    bob: Math.abs(Math.cos(phase * 2)) * 0.035,
    lean: profiles[kind]?.lean ?? profiles.resident.lean,
  };
}
