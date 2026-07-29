export function createGameUi({
  shell,
  title,
  missionHud,
  missionStep,
  missionTitle,
  missionClue,
  objective,
  subtitle,
  approachPrompt,
  interaction,
  tutorialHint,
  compass,
  compassLabel,
  compassDistance,
  marker,
  dangerState,
  completionToast,
  muteToggle,
}) {
  let subtitleTimer;
  let completionTimer;
  let completionActive = false;

  shell.dataset.uiPhase = 'intro';
  title.setAttribute('aria-hidden', 'false');
  interaction.hidden = true;

  function completeIntro() {
    shell.dataset.uiPhase = 'playing';
    title.setAttribute('aria-hidden', 'true');
  }

  function setObjective(text) {
    objective.textContent = text.replace(/^目标：/, '');
  }

  function showSubtitle(text, duration = 4200) {
    clearTimeout(subtitleTimer);
    subtitle.textContent = text;
    subtitle.dataset.visible = 'true';
    subtitleTimer = setTimeout(() => {
      subtitle.dataset.visible = 'false';
    }, duration);
  }

  function showInteraction(label) {
    interaction.hidden = !label;
    interaction.querySelector('span').textContent = label ?? '';
  }

  function renderMission(definition) {
    if (completionActive) return;
    missionStep.textContent = `任务 ${definition.step}/${definition.total}`;
    missionTitle.textContent = definition.title;
    missionClue.textContent = definition.clue;
    setObjective(definition.objective);
    missionHud.dataset.state = 'active';
  }

  function renderGuidance(definition, snapshot, screenMarker) {
    const visible = Boolean(snapshot.targetPosition);
    compass.hidden = completionActive || !visible;
    marker.hidden = completionActive || !visible || !screenMarker;
    approachPrompt.hidden = completionActive || snapshot.proximity !== 'approach';
    interaction.hidden = completionActive
      || snapshot.proximity !== 'interact'
      || !definition.actionLabel;
    if (!visible) return;
    compassLabel.textContent = definition.title;
    compassDistance.textContent = snapshot.distanceLabel;
    compass.style.setProperty('--bearing', `${snapshot.relativeAngle}rad`);
    if (screenMarker) {
      marker.style.transform = `translate3d(${screenMarker.x}px, ${screenMarker.y}px, 0)`;
      marker.dataset.edge = String(screenMarker.edge);
    }
    approachPrompt.textContent = `靠近：${definition.title}`;
    interaction.querySelector('span').textContent = definition.actionLabel ?? '';
  }

  function renderDanger(snapshot) {
    shell.dataset.danger = snapshot.mode;
    dangerState.hidden = snapshot.mode === 'safe';
    dangerState.textContent = snapshot.label;
    shell.style.setProperty('--danger-intensity', snapshot.intensity.toFixed(3));
  }

  function showCompletion(definition) {
    completionActive = true;
    missionStep.textContent = `任务 ${definition.step}/${definition.total}`;
    missionTitle.textContent = definition.title;
    missionClue.textContent = definition.clue;
    completionToast.textContent = `✓ ${definition.title}`;
    completionToast.hidden = false;
    missionHud.dataset.state = 'complete';
    clearTimeout(completionTimer);
    completionTimer = setTimeout(() => {
      completionActive = false;
      completionToast.hidden = true;
      missionHud.dataset.state = 'active';
    }, 800);
  }

  function showTutorial(tutorial) {
    tutorialHint.hidden = !tutorial;
    tutorialHint.textContent = tutorial?.text ?? '';
  }

  function setMuted(muted) {
    muteToggle.setAttribute('aria-pressed', String(muted));
    muteToggle.setAttribute('aria-label', muted ? '开启音效' : '关闭音效');
    muteToggle.textContent = muted ? '🔇' : '🔊';
  }

  function onMute(handler) {
    muteToggle.addEventListener('click', handler);
  }

  const introTimer = setTimeout(completeIntro, 2400);

  return {
    completeIntro() {
      clearTimeout(introTimer);
      completeIntro();
    },
    setObjective,
    showSubtitle,
    showInteraction,
    renderMission,
    renderGuidance,
    renderDanger,
    showCompletion,
    showTutorial,
    setMuted,
    onMute,
    get transitionActive() { return completionActive; },
  };
}
