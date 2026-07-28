import { useState } from 'react';
import MobileMenu from './components/MobileMenu';
import MetadataTable from './components/MetadataTable';
import PreviewMedia from './components/PreviewMedia';
import SearchOverlay from './components/SearchOverlay';
import SiteHeader from './components/SiteHeader';
import TemplateTopBar from './components/TemplateTopBar';
import { mobileMenuItems, pageData } from './data/pageData';
import './styles/app.css';

export default function App() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activePlatform, setActivePlatform] = useState('all');

  const openSearch = () => {
    setIsMenuOpen(false);
    setIsSearchOpen(true);
  };

  const toggleMenu = () => {
    setIsSearchOpen(false);
    setIsMenuOpen((open) => !open);
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
      </main>
      <SearchOverlay
        isOpen={isSearchOpen}
        activePlatform={activePlatform}
        onPlatformChange={setActivePlatform}
        onClose={() => setIsSearchOpen(false)}
      />
      <MobileMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} items={mobileMenuItems} />
    </>
  );
}
