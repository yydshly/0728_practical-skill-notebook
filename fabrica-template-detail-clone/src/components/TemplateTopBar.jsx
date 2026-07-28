export default function TemplateTopBar({ template }) {
  return (
    <section className="template-topbar" aria-label={`${template.name} template details`}>
      <div className="template-topbar__identity">
        <span>Template name</span>
        <h1>{template.name}</h1>
      </div>
      <a href={template.href} target="_blank" rel="noreferrer">
        ↗ Visit
      </a>
    </section>
  );
}
