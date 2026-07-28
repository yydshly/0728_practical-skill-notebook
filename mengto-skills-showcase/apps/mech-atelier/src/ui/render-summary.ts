import { calculateSummary } from "../configuration/calculate-summary";
import { catalog } from "../content/catalog";
import type { MechConfiguration } from "../configuration/types";

export function renderSummary(
  container: HTMLElement,
  config: MechConfiguration,
): void {
  const summary = calculateSummary(config, catalog);
  const chassis = catalog.chassis.find(
    (candidate) => candidate.id === config.chassisId,
  );
  if (!chassis) throw new Error(`Unknown chassis: ${config.chassisId}`);

  container.innerHTML = `
    <div class="summary-heading">
      <div>
        <p class="section-kicker">LIVE SPECIFICATION</p>
        <h2>配置读数</h2>
      </div>
      <span class="summary-status"><i></i> 已验证</span>
    </div>
    <div class="summary-price-row">
      <div>
        <span class="summary-label">概念价格</span>
        <strong data-summary-price>${summary.priceCredits.toLocaleString("en-US")} 信用点</strong>
      </div>
      <p>概念配置，不提供结算或库存功能</p>
    </div>
    <dl class="summary-grid">
      <div class="summary-stat summary-stat--weight">
        <dt>载重</dt>
        <dd data-summary-weight>${summary.weight} / ${chassis.weightLimit} kg</dd>
        <span class="load-track" aria-hidden="true"><i style="width:${Math.min(100, (summary.weight / chassis.weightLimit) * 100)}%"></i></span>
      </div>
      <div class="summary-stat">
        <dt>火力</dt>
        <dd data-summary-power>${summary.power}</dd>
      </div>
      <div class="summary-stat">
        <dt>防护</dt>
        <dd data-summary-guard>${summary.guard}</dd>
      </div>
      <div class="summary-stat">
        <dt>机动</dt>
        <dd data-summary-mobility>${summary.mobility}</dd>
      </div>
    </dl>
  `;
}
