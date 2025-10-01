// start.js - Main startup script for production
const { spawn } = require('child_process');

console.log('Starting Kisu1bot services...');
console.log('Environment:', process.env.NODE_ENV || 'development');

// Set environment variables for child processes
const env = {
  ...process.env,
  NODE_ENV: 'production'
};

// Start the API server on port 3000
const server = spawn('node', ['server.js'], {
  stdio: 'inherit',
  cwd: __dirname,
  env: { ...env, PORT: '3000' }
});

// Wait for server to start, then start the bot on the main port
setTimeout(() => {
  const bot = spawn('node', ['bot.js'], {
    stdio: 'inherit',
    cwd: __dirname,
    env: { ...env, PORT: process.env.PORT || '3001' }
  });

  bot.on('close', (code) => {
    console.log(`Bot process exited with code ${code}`);
    server.kill();
    process.exit(code);
  });
}, 3000);

server.on('close', (code) => {
  console.log(`Server process exited with code ${code}`);
  process.exit(code);
});

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.log('Shutting down services...');
  server.kill();
  process.exit();
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  server.kill();
  process.exit();
});
