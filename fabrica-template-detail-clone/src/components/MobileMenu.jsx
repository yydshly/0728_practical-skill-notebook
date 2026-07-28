export default function MobileMenu({ isOpen, onClose, items }) {
  if (!isOpen) return null;

  return (
    <nav id="mobile-navigation" className="mobile-menu" aria-label="Mobile navigation">
      <div className="mobile-menu__topbar">
        <span className="mobile-menu__label">Navigation</span>
        <button type="button" className="overlay-close" onClick={onClose}>Close navigation</button>
      </div>
      <div className="mobile-menu__links">
        {items.map((item) => <a href={item.href} key={item.href}>{item.label}</a>)}
      </div>
      <div className="mobile-menu__bottom">
        <a href="/about">About Best Website Template</a>
      </div>
    </nav>
  );
}
