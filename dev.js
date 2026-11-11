import { spawn } from 'child_process';

console.log('🚀 Starting Universal Video Downloader (Server + Frontend)...');

const server = spawn('node', ['server/server.js'], { 
  stdio: 'inherit', 
  shell: true 
});

const client = spawn('node', ['node_modules/vite/bin/vite.js'], { 
  stdio: 'inherit', 
  shell: true 
});

const cleanup = () => {
  try { server.kill(); } catch {}
  try { client.kill(); } catch {}
  process.exit();
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);

