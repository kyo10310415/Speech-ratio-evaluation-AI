module.exports = {
  apps: [
    {
      name: 'wannav-dashboard',
      script: 'src/dashboard/server.js',
      interpreter: 'node',
      env: {
        NODE_ENV: 'production',
        DASHBOARD_PORT: 3000,
        DASHBOARD_HOST: '0.0.0.0',
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
    },
  ],
};
