/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: process.env.SITE_URL || 'https://atlas.peargent.online',
  generateRobotsTxt: true,
  generateIndexSitemap: false,
};
