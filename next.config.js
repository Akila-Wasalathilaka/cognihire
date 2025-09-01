/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer, dev }) => {
    // Handle bcrypt and other native modules
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
      };
    }

    // Handle oracledb native module for all environments
    config.externals = config.externals || [];
    config.externals.push({
      'oracledb': 'commonjs oracledb',
    });

    // Additional externals for Edge Runtime
    if (config.name === 'middleware') {
      config.externals.push({
        'bcryptjs': 'commonjs bcryptjs',
        'jsonwebtoken': 'commonjs jsonwebtoken',
      });
    }

    return config;
  },

  // Experimental features for better Edge Runtime support
  experimental: {
    serverComponentsExternalPackages: ['oracledb'],
  },
};

module.exports = nextConfig;
