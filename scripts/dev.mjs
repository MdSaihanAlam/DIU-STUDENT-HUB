// Runs the API and the Vite client together: `npm run dev` (or `npm run dev:mem` for in-memory MongoDB).
import { spawn } from 'node:child_process';

const memory = process.argv.includes('--memory');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const procs = [
  ['api', [npm, ['run', memory ? 'dev:mem' : 'dev', '--workspace', 'server']], '\x1b[36m'],
  ['web', [npm, ['run', 'dev', '--workspace', 'client']], '\x1b[35m'],
].map(([name, [cmd, args], color]) => {
  const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' });
  const prefix = (chunk) =>
    chunk
      .toString()
      .split(/\r?\n/)
      .filter(Boolean)
      .map((l) => `${color}[${name}]\x1b[0m ${l}`)
      .join('\n');
  p.stdout.on('data', (c) => console.log(prefix(c)));
  p.stderr.on('data', (c) => console.error(prefix(c)));
  p.on('exit', (code) => {
    console.log(`[${name}] exited with code ${code}`);
    shutdown();
  });
  return p;
});

let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  procs.forEach((p) => p.kill());
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
