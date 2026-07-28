import { CAPABILITIES } from "../../config/showcaseConfig";

export function StaticFallback({ reason = "unavailable" }) {
  const description =
    reason === "reduced-motion"
      ? "已根据你的动态效果偏好，提供完整的静态浏览方式。"
      : "当前设备无法启动三维展台，以下内容与案例链接仍可完整访问。";

  return (
    <section className="static-fallback" aria-labelledby="fallback-title">
      <header>
        <p className="eyebrow">静态浏览</p>
        <h2 id="fallback-title">三种能力，一次看清</h2>
        <p>{description}</p>
      </header>

      <div className="fallback-grid">
        {CAPABILITIES.map((capability, index) => (
          <article key={capability.id}>
            <p className="fallback-index" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </p>
            <p className="discipline">{capability.discipline}</p>
            <h3>{capability.title}</h3>
            <dl>
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
            <a href={capability.caseHref}>查看案例</a>
          </article>
        ))}
      </div>
    </section>
  );
}
