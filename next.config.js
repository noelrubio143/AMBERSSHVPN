/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      { source: '/', destination: '/landing.html' },
      { source: '/pay', destination: '/pay.html' },
    ];
  },
};

module.exports = nextConfig;
