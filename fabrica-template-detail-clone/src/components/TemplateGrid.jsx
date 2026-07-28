import TemplateCard from './TemplateCard';

export default function TemplateGrid({ templates }) {
  const rows = [];

  for (let index = 0; index < templates.length;) {
    rows.push([templates[index++] ?? null, null, templates[index++] ?? null]);
    if (templates[index]) rows.push([null, templates[index++], null]);
  }

  return (
    <section className="template-grid" aria-label="Recommended templates">
      {rows.flatMap((row, rowIndex) => row.map((item, columnIndex) => (
        <div className="template-grid__slot" key={`${rowIndex}-${columnIndex}`}>
          {item ? <TemplateCard item={item} /> : null}
        </div>
      )))}
    </section>
  );
}
