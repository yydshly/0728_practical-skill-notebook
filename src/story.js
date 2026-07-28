const copy = {
  leave_home: {
    objective: '目标：离开主角家，调查村里的异常。',
    subtitle: '收音机在杂音里重复着一个陌生的名字。',
  },
  visit_courtyard: {
    objective: '目标：前往院落，寻找躲起来的邻居。',
    subtitle: '断断续续的低语从隔壁院墙后传来。',
  },
  reach_granary: {
    objective: '目标：去晒谷场拿到手电，寻找村口出口。',
    subtitle: '邻居压低声音：别回头，去南边的铁门。',
  },
};

export function createStoryDirector({ ui }) {
  const story = {
    objective: 'leave_home',
    flags: { radio: false, neighbour: false, flashlight: false },
  };

  function render() {
    const text = copy[story.objective];
    ui.setObjective(text.objective);
    ui.showSubtitle(text.subtitle);
  }

  function interact(kind) {
    if (kind === 'radio' && !story.flags.radio) {
      story.flags.radio = true;
      story.objective = 'visit_courtyard';
    } else if (kind === 'neighbour' && story.flags.radio && !story.flags.neighbour) {
      story.flags.neighbour = true;
      story.objective = 'reach_granary';
    } else if (kind === 'flashlight' && story.flags.neighbour && !story.flags.flashlight) {
      story.flags.flashlight = true;
      ui.showSubtitle('手电亮起的一刻，主路尽头传来了一声不像人类的喘息。');
      return;
    }
    render();
  }

  function update(player, exitZone) {
    if (!story.flags.flashlight || story.objective === 'complete') return;
    if (player.position.distanceTo(exitZone.center) > exitZone.radius) return;
    story.objective = 'complete';
    ui.setObjective('第一章完成：你穿过了南侧村口。');
    ui.showSubtitle('铁门在身后合拢，雾里仍有人在呼喊你的名字。');
  }

  render();
  return { story, interact, update };
}
