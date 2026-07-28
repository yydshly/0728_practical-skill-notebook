export default function SiteFooter({ groups }) {
  return (
    <footer className="site-footer">
      <div className="site-footer__groups">
        {groups.map((group) => (
          <section key={group.heading}>
            <h2>{group.heading}</h2>
            <ul>
              {group.links.map((link) => <li key={link.href}><a href={link.href}>{link.label}</a></li>)}
            </ul>
          </section>
        ))}
      </div>
      <p className="site-footer__wordmark">Best Website Template</p>
    </footer>
  );
}
