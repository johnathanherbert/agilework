   /** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // Add any other configurations you might need
  images: {
    domains: ['lh3.googleusercontent.com'],
  },
}

module.exports = nextConfig