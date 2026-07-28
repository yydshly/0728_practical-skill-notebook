import { pageData, platformFilters } from './pageData';

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
