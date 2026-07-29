export interface InputSnapshot {
  moveX: number;
  moveY: number;
  attackPressed: boolean;
  guardHeld: boolean;
  dodgePressed: boolean;
  lockPressed: boolean;
}

export type PlayerIntent = InputSnapshot;

const clamp = (value: number): number => Number.isFinite(value)
  ? Math.max(-1, Math.min(1, value))
  : 0;

export const normalizeInput = (input: InputSnapshot): PlayerIntent => ({
  ...input,
  moveX: clamp(input.moveX),
  moveY: clamp(input.moveY),
});
