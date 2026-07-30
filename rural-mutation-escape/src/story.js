import { getObjectiveDefinition } from './objectives.js';

export function createStoryDirector({ ui, onEvent = () => {} }) {
  const story = {
    objective: 'leave_home',
    flags: { radio: false, neighbour: false, flashlight: false },
  };

  function render() {
    const definition = getObjectiveDefinition(story.objective);
    ui.setObjective(definition.objective);
    ui.showSubtitle(definition.subtitle);
    return definition;
  }

  function transition(nextObjectiveId) {
    const objectiveId = story.objective;
    if (objectiveId === nextObjectiveId) return false;
    onEvent({ type: 'objective-completed', objectiveId, nextObjectiveId });
    story.objective = nextObjectiveId;
    onEvent({
      type: nextObjectiveId === 'complete' ? 'chapter-completed' : 'objective-started',
      objectiveId: nextObjectiveId,
    });
    render();
    return true;
  }

  function interact(kind) {
    if (kind === 'radio' && !story.flags.radio) {
      story.flags.radio = true;
      return transition('visit_courtyard');
    }
    if (kind === 'neighbour' && story.flags.radio && !story.flags.neighbour) {
      story.flags.neighbour = true;
      return transition('reach_granary');
    }
    if (kind === 'flashlight' && story.flags.neighbour && !story.flags.flashlight) {
      story.flags.flashlight = true;
      const changed = transition('escape_south_gate');
      if (changed) {
        ui.showSubtitle('手电亮起的一刻，主路尽头传来了一声不像人类的喘息。');
      }
      return changed;
    }
    return false;
  }

  function update(player, exitZone) {
    if (!story.flags.flashlight || story.objective === 'complete') return false;
    if (player.position.distanceTo(exitZone.center) > exitZone.radius) return false;
    return transition('complete');
  }

  render();
  return { story, interact, update, render };
}
