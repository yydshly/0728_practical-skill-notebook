const assetPath = (path) => `/assets/${path}`;

export const platformFilters = [
  { label: 'All', value: 'all' },
  { label: 'Framer', value: 'framer' },
  { label: 'Webflow', value: 'webflow' },
  { label: 'Shopify', value: 'shopify' },
];

export const mobileMenuItems = [
  { label: 'Templates', href: '/templates' },
  { label: 'Webflow', href: '/templates/webflow' },
  { label: 'Framer', href: '/templates/framer' },
  { label: 'Shopify', href: '/templates/shopify' },
  { label: 'Blog', href: '/blog' },
];

const recommendation = (name, score, price, href, image) => ({
  name,
  score,
  price,
  href,
  visitHref: `https://www.framer.com/marketplace/templates/${href.split('/').at(-1)}/`,
  imageSrc: assetPath(`templates/${image}`),
  imageAlt: `${name} template preview`,
});

export const pageData = {
  template: {
    name: 'Fabrica',
    score: '9.55',
    price: '$129',
    href: 'https://www.framer.com/marketplace/templates/fabrica/',
    description:
      'Fabrica works best for portfolio and agency projects that need smooth motion and video backgrounds.',
    overview:
      'Fabrica is a high-quality Framer template for Portfolio & Agency, Art & Design, Business & Startup, Professional Services, Blog & Editorial by Anatolii Dmitrienko.',
  },
  preview: {
    videoSrc: assetPath('media/fabrica-preview.mp4'),
    posterSrc: assetPath('templates/fabrica-1440x810.webp'),
    posterAlt: 'Fabrica template preview',
  },
  details: [
    { label: 'Overall score', value: '9.55' },
    { label: 'Design', value: '9.45' },
    { label: 'Development', value: '9.65' },
    { label: 'Price', value: '$129' },
    { label: 'Creator', value: 'Anatolii Dmitrienko' },
    { label: 'Builder', value: 'Framer' },
    { label: 'Portfolio & Agency', value: 'Category' },
    { label: 'Art & Design', value: 'Category' },
    { label: 'Business & Startup', value: 'Category' },
    { label: 'Professional Services', value: 'Category' },
  ],
  recommendations: [
    recommendation('Deformo', '7.00', '$99', '/templates/framer/deformo', 'deformo-1440x810.webp'),
    recommendation('BEBOLD', '9.25', '$99', '/templates/framer/bebold', 'bebold-1440x810.webp'),
    recommendation('Noora', '7.00', 'Free', '/templates/framer/noora', 'noora-1440x810.webp'),
    recommendation('Monica Ellis', '9.50', '$49', '/templates/framer/monica-ellis', 'monica-ellis-1440x810.webp'),
    recommendation('Fuel', '9.50', 'Free', '/templates/framer/fuel', 'fuel-1440x810.webp'),
    recommendation('Plutarch', '9.50', '$59', '/templates/framer/plutarch', 'plutarch-1440x810.webp'),
    recommendation('Solace A', '9.35', '$39', '/templates/framer/solace-a', 'solace-a-1440x810.webp'),
    recommendation('Viper', '9.18', 'Free', '/templates/framer/viper', 'viper-1440x810.webp'),
    recommendation('Bungee', '9.00', 'Free', '/templates/framer/bungee', 'bungee-1440x810.webp'),
    recommendation('Citeflow', '8.55', 'Free', '/templates/framer/citeflow', 'citeflow-1440x810.webp'),
    recommendation('Trifecta', '8.50', '$129', '/templates/framer/trifecta', 'trifecta-1440x810.webp'),
    recommendation('Demibold', '8.13', '$79', '/templates/framer/demibold', 'demibold-1440x810.webp'),
    recommendation('Mobius', '7.22', '$99', '/templates/framer/mobius', 'mobius-1440x810.webp'),
    recommendation('Riwa', '9.40', '$99', '/templates/framer/riwa', 'riwa-1440x810.webp'),
  ],
  blogs: [
    {
      title: '20 Best Framer Portfolio Templates 2026 (Scored by Designers)',
      href: '/blog/20-best-framer-portfolio-templates-2026-scored-by-designers',
      imageSrc: assetPath('blogs/20-best-framer-portfolio-templates-2026-scored-by-designers.webp'),
      imageAlt: '20 Best Framer Portfolio Templates 2026 (Scored by Designers)',
    },
    {
      title: '30 Best Free & Paid Framer Website Templates 2026',
      href: '/blog/30-best-free-paid-framer-website-templates-2026',
      imageSrc: assetPath('blogs/30-best-free-paid-framer-website-templates-2026.webp'),
      imageAlt: '30 Best Free & Paid Framer Website Templates 2026',
    },
    {
      title: 'How Much Do Website Templates Cost in 2026? Real Prices From 860 Reviewed Templates',
      href: '/blog/how-much-do-website-templates-cost-in-2026-real-prices-from-860-reviewed-templates',
      imageSrc: assetPath('blogs/how-much-do-website-templates-cost-in-2026.webp'),
      imageAlt: 'How Much Do Website Templates Cost in 2026? Real Prices From 860 Reviewed Templates',
    },
    {
      title: 'We Scored 860 Website Templates. Here Is What the Data Shows in 2026',
      href: '/blog/we-scored-860-website-templates-here-is-what-the-data-shows-in-2026',
      imageSrc: assetPath('blogs/we-scored-860-website-templates-2026.webp'),
      imageAlt: 'We Scored 860 Website Templates. Here Is What the Data Shows in 2026',
    },
  ],
  footerGroups: [
    {
      heading: 'Explore',
      links: [
        { label: 'Templates', href: '/templates' },
        { label: 'Framer', href: '/templates/framer' },
        { label: 'Webflow', href: '/templates/webflow' },
        { label: 'Shopify', href: '/templates/shopify' },
      ],
    },
    {
      heading: 'Resources',
      links: [
        { label: 'Blog', href: '/blog' },
        { label: 'Scoring Methodology', href: '/methodology' },
        { label: 'Free Cost Calculator', href: '/platform-cost-calculator' },
      ],
    },
    {
      heading: 'Company',
      links: [
        { label: 'About', href: '/about' },
        { label: 'Sitemap', href: '/site-map' },
        { label: 'Privacy', href: '/privacy-policy' },
      ],
    },
  ],
};
