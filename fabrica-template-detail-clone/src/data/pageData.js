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
    { label: 'Overall score', value: '9.55 ★' },
    { label: 'Design score', value: '9.45 ★' },
    { label: 'Development score', value: '9.65 ★' },
    { label: 'Price', value: '$129' },
    {
      label: 'Features',
      value: 'CMS, Form (s), Components, Animation, Responsive design, Rich Media, Site Search, Slideshows/Tickers, Sticky Scrolling, Layout Templates, Multi Page, Blog, Contact Page, About Page, 404 Page, Projects/Works Page, Pricing, Jobs & Careers, Background video, Typography',
    },
    {
      label: 'Category',
      value: 'Portfolio & Agency, Art & Design, Business & Startup, Professional Services, Blog & Editorial',
    },
    { label: 'Style', value: 'Animation, Minimal, Typographic, Bold, Monochromatic, Modern, Clean' },
    { label: 'Creator', value: 'Anatolii Dmitrienko' },
    { label: 'Website builder', value: 'Framer' },
    { label: 'Overview', value: 'Fabrica works best for portfolio and agency projects that need smooth motion and video backgrounds.' },
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
      author: 'Skyler Moss',
      date: 'Jul 17, 2026',
      imageSrc: assetPath('blogs/20-best-framer-portfolio-templates-2026-scored-by-designers.webp'),
      imageAlt: '20 Best Framer Portfolio Templates 2026 (Scored by Designers)',
    },
    {
      title: '30 Best Free & Paid Framer Website Templates 2026',
      href: '/blog/30-best-free-paid-framer-website-templates-2026',
      author: 'Maren Brooks',
      date: 'Jul 17, 2026',
      imageSrc: assetPath('blogs/30-best-free-paid-framer-website-templates-2026.webp'),
      imageAlt: '30 Best Free & Paid Framer Website Templates 2026',
    },
    {
      title: 'How Much Do Website Templates Cost in 2026? Real Prices From 860 Reviewed Templates',
      href: '/blog/how-much-do-website-templates-cost-in-2026-real-prices-from-860-reviewed-templates',
      author: 'Dean Merrick',
      date: 'Jul 17, 2026',
      imageSrc: assetPath('blogs/how-much-do-website-templates-cost-in-2026.webp'),
      imageAlt: 'How Much Do Website Templates Cost in 2026? Real Prices From 860 Reviewed Templates',
    },
    {
      title: 'We Scored 860 Website Templates. Here Is What the Data Shows in 2026',
      href: '/blog/we-scored-860-website-templates-here-is-what-the-data-shows-in-2026',
      author: 'Maren Brooks',
      date: 'Jul 17, 2026',
      imageSrc: assetPath('blogs/we-scored-860-website-templates-2026.webp'),
      imageAlt: 'We Scored 860 Website Templates. Here Is What the Data Shows in 2026',
    },
  ],
  footerGroups: [
    {
      heading: 'Templates',
      links: [
        { label: 'All', href: '/templates' },
        { label: 'Webflow Templates', href: '/templates/webflow' },
        { label: 'Framer Templates', href: '/templates/framer' },
        { label: 'Shopify Themes', href: '/templates/shopify' },
      ],
    },
    {
      heading: 'Framer',
      links: [
        { label: 'All', href: '/templates/framer' },
        { label: 'Free', href: '/templates/framer/free' },
        { label: 'Paid', href: '/templates/framer/paid' },
      ],
    },
    {
      heading: 'Webflow',
      links: [
        { label: 'All', href: '/templates/webflow' },
        { label: 'Free', href: '/templates/webflow/free' },
        { label: 'Paid', href: '/templates/webflow/paid' },
      ],
    },
    {
      heading: 'Shopify',
      links: [
        { label: 'All', href: '/templates/shopify' },
        { label: 'Free', href: '/templates/shopify/free' },
        { label: 'Paid', href: '/templates/shopify/paid' },
      ],
    },
    {
      heading: 'Pages',
      links: [
        { label: 'Blogs', href: '/blog' },
        { label: 'About', href: '/about' },
        { label: 'Scoring Methodology', href: '/methodology' },
        { label: 'Free Cost Calculator', href: '/platform-cost-calculator' },
        { label: 'Platform Comparison', href: '/blog/webflow-vs-framer-vs-shopify-which-platform-should-you-build-on' },
      ],
    },
    {
      heading: 'Links',
      links: [
        { label: 'Glossary', href: '/blog/website-template-glossary-every-term-youll-actually-need' },
        { label: 'Sitemap', href: '/site-map' },
        { label: 'Privacy Policy', href: '/privacy-policy' },
        { label: 'Cookies Policy', href: '/cookies' },
        { label: 'For AI', href: '/for-ai' },
      ],
    },
    {
      heading: 'Socials',
      links: [
        { label: 'LinkedIn', href: 'https://www.linkedin.com/company/best-website-templates', icon: 'linkedin' },
        { label: 'Instagram', href: 'https://www.instagram.com/best_website_templates', icon: 'instagram' },
        { label: 'TikTok', href: 'https://www.tiktok.com/@bestwebsitetemplate', icon: 'tiktok' },
        { label: 'X', href: 'https://x.com/website_tmplts', icon: 'x' },
        { label: 'YouTube', href: 'https://www.youtube.com/@Bestwebsitetemplate', icon: 'youtube' },
        { label: 'Facebook', href: 'https://www.facebook.com/people/Best-Website-Templates/61578580390250/', icon: 'facebook' },
        { label: 'Pinterest', href: 'https://www.pinterest.com/bestwebsitetmplts/', icon: 'pinterest' },
        { label: 'Bluesky', href: 'https://bsky.app/profile/bestwebsitetmplts.bsky.social', icon: 'bluesky' },
        { label: 'Threads', href: 'https://www.threads.com/@best_website_templates', icon: 'threads' },
      ],
    },
  ],
};
