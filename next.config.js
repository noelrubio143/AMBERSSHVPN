/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      { source: '/', destination: '/landing.html' },
      { source: '/privacy-policy', destination: '/privacy-policy.html' },
    ];
  },
};

module.exports = nextConfig;
