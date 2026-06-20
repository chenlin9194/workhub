module.exports = {
  apps: [
    {
      name: 'local-work-log',
      script: 'npx',
      args: 'next dev -p 3000 -H 0.0.0.0',
      env: {
        NODE_ENV: 'development',
        DATABASE_URL: 'file:./dev.db',
        PORT: 3000
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork'
    }
  ]
}
