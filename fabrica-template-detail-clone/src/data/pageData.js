const assetPath = (path) => `/assets/${path}`;

export const platformFilters = [
  { label: 'All', value: 'all' },
  { label: 'Framer', value: 'framer' },
  { label: 'Webflow', value: 'webflow' },
  { label: 'Shopify', value: 'shopify' },
];

export const mobileMenuItems = [
  { label: 'Templates', href: '#templates' },
  { label: 'Inspiration', href: '#inspiration' },
  { label: 'Resources', href: '#resources' },
  { label: 'Submit a template', href: '#submit' },
];

const recommendation = (name, score, price, image) => ({
  name,
  score,
  price,
  href: `#${name.toLowerCase().replaceAll(' ', '-')}`,
  imageSrc: assetPath(`templates/${image}`),
  imageAlt: `${name} template preview`,
});

export const pageData = {
  template: {
    name: 'Fabrica',
    score: '4.8',
    price: '$49',
    href: '#visit-fabrica',
    description:
      'Fabrica works best for portfolio and agency projects that need smooth motion and video backgrounds.',
  },
  preview: {
    videoSrc: assetPath('media/fabrica-preview.mp4'),
    posterSrc: assetPath('templates/fabrica-1440x810.webp'),
    posterAlt: 'Fabrica template preview',
  },
  details: [
    { label: 'Overall score', value: '4.8 / 5' },
    { label: 'Platform', value: 'Framer' },
    { label: 'Best for', value: 'Portfolios and agencies' },
    { label: 'Price', value: '$49' },
    { label: 'Pages', value: '10+ pages' },
    { label: 'CMS', value: 'Included' },
    { label: 'Responsive', value: 'Yes' },
    { label: 'Animations', value: 'Included' },
    { label: 'Last updated', value: '2026' },
    { label: 'License', value: 'Single project' },
  ],
  recommendations: [
    recommendation('Deformo', '4.9', '$49', 'deformo-1440x810.webp'),
    recommendation('BeBold', '4.8', '$39', 'bebold-1440x810.webp'),
    recommendation('Noora', '4.8', '$49', 'noora-1440x810.webp'),
    recommendation('Monica Ellis', '4.7', '$49', 'monica-ellis-1440x810.webp'),
    recommendation('Fuel', '4.7', '$39', 'fuel-1440x810.webp'),
    recommendation('Plutarch', '4.7', '$49', 'plutarch-1440x810.webp'),
    recommendation('Solace A', '4.6', '$49', 'solace-a-1440x810.webp'),
    recommendation('Viper', '4.6', '$39', 'viper-1440x810.webp'),
    recommendation('Bungee', '4.6', '$49', 'bungee-1440x810.webp'),
    recommendation('Citeflow', '4.5', '$39', 'citeflow-1440x810.webp'),
    recommendation('Trifecta', '4.5', '$49', 'trifecta-1440x810.webp'),
    recommendation('Demibold', '4.5', '$39', 'demibold-1440x810.webp'),
    recommendation('Mobius', '4.4', '$49', 'mobius-1440x810.webp'),
    recommendation('Riwa', '4.4', '$39', 'riwa-1440x810.webp'),
  ],
  blogs: [
    {
      title: '30 best free and paid Framer website templates in 2026',
      href: '#best-framer-templates',
      imageSrc: assetPath('blogs/30-best-free-paid-framer-website-templates-2026-1.webp'),
      imageAlt: 'A collection of Framer website templates',
    },
    {
      title: '30 best free and paid Framer website templates in 2026',
      href: '#best-framer-templates-guide',
      imageSrc: assetPath('blogs/30-best-free-paid-framer-website-templates-2026-2.webp'),
      imageAlt: 'A second collection of Framer website templates',
    },
  ],
  footerGroups: [
    {
      heading: 'Explore',
      links: [
        { label: 'Templates', href: '#templates' },
        { label: 'Framer', href: '#framer' },
        { label: 'Webflow', href: '#webflow' },
        { label: 'Shopify', href: '#shopify' },
      ],
    },
    {
      heading: 'Resources',
      links: [
        { label: 'Inspiration', href: '#inspiration' },
        { label: 'Blog', href: '#blog' },
        { label: 'Submit a template', href: '#submit' },
      ],
    },
    {
      heading: 'Company',
      links: [
        { label: 'About', href: '#about' },
        { label: 'Contact', href: '#contact' },
        { label: 'Privacy', href: '#privacy' },
      ],
    },
  ],
};
