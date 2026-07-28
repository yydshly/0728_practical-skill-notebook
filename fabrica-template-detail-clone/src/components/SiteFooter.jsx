export default function SiteFooter({ groups }) {
  return (
    <footer className="site-footer">
      <div className="site-footer__topline">
        <img src="/assets/icons/site-mark.svg" alt="Best Website Template" />
        <p><strong>English</strong><span>Español</span><span>Português</span><span>© 2026</span></p>
      </div>
      <div className="site-footer__groups">
        {groups.map((group) => (
          <section key={group.heading} className={group.heading === 'Socials' ? 'site-footer__socials' : undefined}>
            <h2>{group.heading}</h2>
            <ul>
              {group.links.map((link) => (
                <li key={link.href}>
                  <a href={link.href} target={link.icon ? '_blank' : undefined} rel={link.icon ? 'noreferrer' : undefined} aria-label={link.icon ? link.label : undefined}>
                    {link.icon ? <img src={`/assets/icons/${link.icon}.svg`} alt="" /> : link.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="site-footer__wordmark">WEBSITE TEMPLATES</p>
    </footer>
  );
}
