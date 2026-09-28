/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      { source: '/', destination: '/landing.html' },
    ];
  },
};

module.exports = nextConfig;
