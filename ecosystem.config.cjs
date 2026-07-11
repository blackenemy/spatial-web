module.exports = {
  apps: [
    {
      name: 'spatial-web',
      script: 'node_modules/.bin/serve',
      args: '-s dist -l 5273',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
