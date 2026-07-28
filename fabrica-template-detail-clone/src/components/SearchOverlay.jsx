import { platformFilters } from '../data/pageData';

export default function SearchOverlay({ isOpen, activePlatform, onPlatformChange, onClose }) {
  if (!isOpen) return null;

  return (
    <section className="search-overlay" role="dialog" aria-modal="true" aria-label="Search templates">
      <div className="search-overlay__topbar">
        <p className="search-overlay__eyebrow">Find your next website template</p>
        <button type="button" className="overlay-close" onClick={onClose}>Cancel</button>
      </div>
      <label className="search-overlay__input-wrap">
        <span className="sr-only">Search for categories or templates</span>
        <span className="search-overlay__icon" aria-hidden="true">⌕</span>
        <input type="search" autoFocus placeholder="Search for categories or templates" aria-label="Search for categories or templates" />
      </label>
      <div className="search-overlay__section">
        <p className="search-overlay__label">Platform</p>
        <div className="platform-filters" aria-label="Filter templates by platform">
          {platformFilters.map((filter) => (
            <button
              type="button"
              key={filter.value}
              className={activePlatform === filter.value ? 'is-active' : ''}
              aria-pressed={activePlatform === filter.value}
              onClick={() => onPlatformChange(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>
      <div className="search-overlay__section search-overlay__categories">
        <p className="search-overlay__label">Browse by category</p>
        <div>
          <a href="/templates/portfolio-agency">Portfolio &amp; Agency</a>
          <a href="/templates/art-design">Art &amp; Design</a>
          <a href="/templates/business-startup">Business &amp; Startup</a>
          <a href="/templates/professional-services">Professional Services</a>
        </div>
      </div>
    </section>
  );
}
