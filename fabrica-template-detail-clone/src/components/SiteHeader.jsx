export default function SiteHeader({ onOpenSearch, onToggleMenu, isMenuOpen }) {
  return (
    <header className="site-header">
      <a className="site-header__brand" href="/" aria-label="Best Website Template home">
        <img src="/assets/icons/site-mark.svg" alt="" aria-hidden="true" />
        <span>Best Website Template</span>
      </a>

      <nav className="site-header__desktop-nav" aria-label="Primary navigation">
        <a href="/templates">Templates</a>
        <button className="site-header__search-field" type="button" onClick={onOpenSearch} aria-label="Open template search">
          Search templates
        </button>
        <a href="/blog">Blog</a>
      </nav>

      <div className="site-header__mobile-actions">
        <button className="site-header__mobile-search" type="button" onClick={onOpenSearch} aria-label="Search templates">
          Search
        </button>
        <button
          className="site-header__menu-button"
          type="button"
          onClick={onToggleMenu}
          aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isMenuOpen}
          aria-controls="mobile-navigation"
        >
          {isMenuOpen ? <span aria-hidden="true">×</span> : <img src="/assets/icons/menu.svg" alt="" aria-hidden="true" />}
        </button>
      </div>
    </header>
  );
}
