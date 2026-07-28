import { useState } from 'react';
import MobileMenu from './components/MobileMenu';
import SearchOverlay from './components/SearchOverlay';
import SiteHeader from './components/SiteHeader';
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
      <main><h1 className="sr-only">{pageData.template.name}</h1></main>
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
