export default function TemplateCard({ item }) {
  const { name, score, price, href, imageSrc, imageAlt } = item;

  return (
    <article className="template-card">
      <p className="template-card__score">{score} ★</p>
      <a className="template-card__link" href={href} aria-label={`View ${name} template`}>
        <img className="template-card__image" src={imageSrc} alt={imageAlt} />
      </a>
      <div className="template-card__bottom">
        <div className="template-card__name">
          <h3>{name}</h3>
        </div>
        <p>{price}</p>
      </div>
    </article>
  );
}
