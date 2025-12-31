/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Headers for camera permissions on Vercel
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'camera=(self)',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
