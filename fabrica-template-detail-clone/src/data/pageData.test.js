import { mobileMenuItems, pageData, platformFilters } from './pageData';

test('has a local preview asset and complete template metadata', () => {
  expect(pageData.preview.videoSrc).toMatch(/^\/assets\/media\//);
  expect(pageData.details).toHaveLength(10);
  expect(pageData.recommendations).toHaveLength(14);
});

test('defines the four visible search platforms', () => {
  expect(platformFilters.map(({ label }) => label)).toEqual([
    'All',
    'Framer',
    'Webflow',
    'Shopify',
  ]);
});

test('uses the observed Fabrica visit destination and source scores', () => {
  expect(pageData.template.href).toBe(
    'https://www.framer.com/marketplace/templates/fabrica/',
  );
  expect(pageData.details.slice(0, 3)).toEqual([
    { label: 'Overall score', value: '9.55' },
    { label: 'Design', value: '9.45' },
    { label: 'Development', value: '9.65' },
  ]);
});

test('keeps recommendation and mobile-menu destinations as observed routes', () => {
  expect(pageData.recommendations[0]).toMatchObject({
    name: 'Deformo',
    score: '7.00',
    price: '$99',
    href: '/templates/framer/deformo',
  });
  expect(pageData.recommendations.at(-1)).toMatchObject({
    name: 'Riwa',
    score: '9.40',
    price: '$99',
    href: '/templates/framer/riwa',
  });
  expect(mobileMenuItems).toEqual([
    { label: 'Templates', href: '/templates' },
    { label: 'Webflow', href: '/templates/webflow' },
    { label: 'Framer', href: '/templates/framer' },
    { label: 'Shopify', href: '/templates/shopify' },
    { label: 'Blog', href: '/blog' },
  ]);
});
