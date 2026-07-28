import TemplateCard from './TemplateCard';

export default function TemplateGrid({ templates }) {
  return (
    <section className="template-grid" aria-label="Recommended templates">
      {templates.map((item) => <TemplateCard key={item.href} item={item} />)}
    </section>
  );
}
