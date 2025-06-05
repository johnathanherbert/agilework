   /** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // Generate a unique build ID for each build
  generateBuildId: async () => {
    // Use timestamp for development, git hash for production
    return process.env.VERCEL_GIT_COMMIT_SHA || `build-${Date.now()}`;
  },
  // Add environment variables
  env: {
    NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA || `build-${Date.now()}`,
  },
  // Add any other configurations you might need
  images: {
    domains: ['lh3.googleusercontent.com'],
  },
}

module.exports = nextConfig