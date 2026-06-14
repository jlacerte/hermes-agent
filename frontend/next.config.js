/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Le runtime CopilotKit roule cote serveur (Node), pas en edge.
  experimental: {},
};

module.exports = nextConfig;
