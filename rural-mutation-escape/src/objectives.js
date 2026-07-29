export const OBJECTIVE_DEFINITIONS = Object.freeze({
  leave_home: Object.freeze({
    id: 'leave_home', step: 1, total: 4, anchorId: 'radio',
    title: '调查收音机',
    clue: '杂音来自主角家亮着灯的窗边。',
    objective: '离开主角家，调查村里的异常。',
    subtitle: '收音机在杂音里重复着一个陌生的名字。',
    interactionKind: 'radio', actionLabel: '调查收音机',
  }),
  visit_courtyard: Object.freeze({
    id: 'visit_courtyard', step: 2, total: 4, anchorId: 'neighbour',
    title: '找到邻居',
    clue: '低语来自主路东侧的院落。',
    objective: '前往院落，寻找躲起来的邻居。',
    subtitle: '断断续续的低语从隔壁院墙后传来。',
    interactionKind: 'neighbour', actionLabel: '询问邻居',
  }),
  reach_granary: Object.freeze({
    id: 'reach_granary', step: 3, total: 4, anchorId: 'flashlight',
    title: '获取手电',
    clue: '手电落在南侧粮仓的冷光旁。',
    objective: '去晒谷场拿到手电，寻找村口出口。',
    subtitle: '邻居压低声音：别回头，去南边的铁门。',
    interactionKind: 'flashlight', actionLabel: '拾取手电筒',
  }),
  escape_south_gate: Object.freeze({
    id: 'escape_south_gate', step: 4, total: 4, anchorId: 'south_gate',
    title: '逃往南门',
    clue: '主路尽头的铁门是唯一出口。',
    objective: '沿主路逃往南侧村口。',
    subtitle: '主路尽头的铁门，是离开雾村的唯一方向。',
    interactionKind: null, actionLabel: null,
  }),
  complete: Object.freeze({
    id: 'complete', step: 4, total: 4, anchorId: null,
    title: '逃出雾村',
    clue: '第一章完成',
    objective: '第一章完成：你穿过了南侧村口。',
    subtitle: '铁门在身后合拢，雾里仍有人在呼喊你的名字。',
    interactionKind: null, actionLabel: null,
  }),
});

export function getObjectiveDefinition(objectiveId) {
  const definition = OBJECTIVE_DEFINITIONS[objectiveId];
  if (!definition) throw new Error(`Unknown objective: ${objectiveId}`);
  return definition;
}

export function resolveObjectiveTarget(objectiveId, anchors) {
  const definition = getObjectiveDefinition(objectiveId);
  return definition.anchorId ? anchors[definition.anchorId] ?? null : null;
}

export function validateObjectiveDefinitions(definitions, anchorIds) {
  const errors = [];
  for (const definition of Object.values(definitions)) {
    if (definition.anchorId && !anchorIds.has(definition.anchorId)) {
      errors.push(`objective:${definition.id}:missing-anchor:${definition.anchorId}`);
    }
    if (definition.step < 1 || definition.step > definition.total) {
      errors.push(`objective:${definition.id}:invalid-step`);
    }
  }
  return errors;
}
