export default function TemplateCard({ item }) {
  const { name, score, price, href, visitHref, imageSrc, imageAlt } = item;

  return (
    <article className="template-card">
      <p className="template-card__score">{score}</p>
      <a className="template-card__link" href={href} aria-label={`View ${name} template`}>
        <img className="template-card__image" src={imageSrc} alt={imageAlt} />
      </a>
      <div className="template-card__bottom">
        <div>
          <h3>{name}</h3>
          <p>{price}</p>
        </div>
        <a className="template-card__visit" href={visitHref} target="_blank" rel="noreferrer">
          Visit <span aria-hidden="true">↗</span>
        </a>
      </div>
    </article>
  );
}
