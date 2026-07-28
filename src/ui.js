export function createGameUi({
  shell,
  title,
  objective,
  subtitle,
  interaction,
}) {
  let subtitleTimer;

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

  const introTimer = setTimeout(completeIntro, 2400);

  return {
    completeIntro() {
      clearTimeout(introTimer);
      completeIntro();
    },
    setObjective,
    showSubtitle,
    showInteraction,
  };
}
