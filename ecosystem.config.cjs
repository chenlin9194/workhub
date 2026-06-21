module.exports = {
  apps: [
    {
      name: 'local-work-log',
      script: 'npx',
      args: 'next dev -p 3000 -H 127.0.0.1',
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
