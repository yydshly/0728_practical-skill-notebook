import { CAPABILITIES } from "../../config/showcaseConfig";
import { useShowcaseStore } from "../../state/useShowcaseStore";

export function OutcomePanel() {
  const selectedIndex = useShowcaseStore((state) => state.selectedIndex);
  const capability = CAPABILITIES[selectedIndex];

  return (
    <article
      className="outcome-panel"
      aria-live="polite"
      aria-atomic="true"
    >
      <header>
        <p className="eyebrow">当前成果</p>
        <p className="discipline">{capability.discipline}</p>
        <h1>{capability.title}</h1>
      </header>

      <dl className="outcome-details">
        <div>
          <dt>适用场景</dt>
          <dd>{capability.scenario}</dd>
        </div>
        <div>
          <dt>预期成果</dt>
          <dd>{capability.outcome}</dd>
        </div>
        <div>
          <dt>现有案例</dt>
          <dd>{capability.proof}</dd>
        </div>
      </dl>

      <a className="case-link" href={capability.caseHref}>
        查看案例
        <span aria-hidden="true">↗</span>
      </a>
    </article>
  );
}
