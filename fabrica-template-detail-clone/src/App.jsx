import { useState } from 'react';
import BlogRail from './components/BlogRail';
import CookieBanner from './components/CookieBanner';
import MobileMenu from './components/MobileMenu';
import MetadataTable from './components/MetadataTable';
import PreviewMedia from './components/PreviewMedia';
import SearchOverlay from './components/SearchOverlay';
import SiteFooter from './components/SiteFooter';
import SiteHeader from './components/SiteHeader';
import TemplateGrid from './components/TemplateGrid';
import TemplateTopBar from './components/TemplateTopBar';
import { mobileMenuItems, pageData } from './data/pageData';
import './styles/app.css';

export default function App() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activePlatform, setActivePlatform] = useState('all');
  const [cookieAccepted, setCookieAccepted] = useState(
    () => window.localStorage.getItem('fabrica-cookie-accepted') === 'true',
  );

  const openSearch = () => {
    setIsMenuOpen(false);
    setIsSearchOpen(true);
  };

  const toggleMenu = () => {
    setIsSearchOpen(false);
    setIsMenuOpen((open) => !open);
  };

  const acceptCookies = () => {
    window.localStorage.setItem('fabrica-cookie-accepted', 'true');
    setCookieAccepted(true);
  };

  return (
    <>
      <SiteHeader onOpenSearch={openSearch} onToggleMenu={toggleMenu} isMenuOpen={isMenuOpen} />
      <main>
        <TemplateTopBar template={pageData.template} />
        <PreviewMedia {...pageData.preview} alt={pageData.preview.posterAlt} />
        <section className="template-details" aria-label="Template metadata">
          <p className="template-details__description">{pageData.template.description}</p>
          <MetadataTable rows={pageData.details} />
        </section>
        <section className="content-section" aria-labelledby="recommendations-heading">
          <h2 id="recommendations-heading">Recommended templates</h2>
          <TemplateGrid templates={pageData.recommendations} />
        </section>
        <section className="content-section" aria-labelledby="related-posts-heading">
          <h2 id="related-posts-heading">Related posts</h2>
          <BlogRail posts={pageData.blogs} />
        </section>
      </main>
      <SiteFooter groups={pageData.footerGroups} />
      <SearchOverlay
        isOpen={isSearchOpen}
        activePlatform={activePlatform}
        onPlatformChange={setActivePlatform}
        onClose={() => setIsSearchOpen(false)}
      />
      <MobileMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} items={mobileMenuItems} />
      <CookieBanner accepted={cookieAccepted} onAccept={acceptCookies} />
    </>
  );
}
