export default function TemplateTopBar({ template }) {
  return (
    <section className="template-topbar" aria-label={`${template.name} template details`}>
      <div>
        <p className="template-topbar__eyebrow">Framer template</p>
        <h1>{template.name}</h1>
      </div>
      <a href={template.href} target="_blank" rel="noreferrer">
        Visit <span aria-hidden="true">↗</span>
      </a>
    </section>
  );
}
