#!/usr/bin/env node

/**
 * VibeDesk (Workstation Monitor) CLI Launcher
 * 
 * Enables one-command startup via:
 *   - npx vibedesk
 *   - npx workstation-monitor
 *   - npm install -g vibedesk && vibedesk
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const https = require('https');
const { spawn, execSync } = require('child_process');

const VERSION = '0.3.0';
const GITHUB_REPO = 'army-u8/workstation-monitor';
const DEFAULT_PORT = 9527;

// Terminal styling helpers
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  emerald: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
};

function printBanner() {
  console.log(`
${colors.cyan}${colors.bold}  █░█ █ █▄▄ █▀▀ █▀▄ █▀▀ █▀ █▄▀${colors.reset}
${colors.blue}${colors.bold}  ▀▄▀ █ █▄█ ██▄ █▄▀ ██▄ ▄█ █ █${colors.reset}  ${colors.dim}v${VERSION}${colors.reset}
  ${colors.dim}macOS Workstation Mission Control & AI Coding Cockpit${colors.reset}
`);
}

function printHelp() {
  printBanner();
  console.log(`${colors.bold}USAGE:${colors.reset}
  ${colors.cyan}npx vibedesk${colors.reset} [OPTIONS] [PORT]
  ${colors.cyan}vibedesk${colors.reset} [SUBCOMMAND] [OPTIONS]

${colors.bold}SUBCOMMANDS:${colors.reset}
  ${colors.emerald}status${colors.reset}             Check if VibeDesk daemon is currently running
  ${colors.emerald}stop${colors.reset}               Stop running VibeDesk server daemon
  ${colors.emerald}open${colors.reset}               Open the active dashboard in default web browser
  ${colors.emerald}update${colors.reset}             Check for newer VibeDesk releases on GitHub

${colors.bold}OPTIONS:${colors.reset}
  ${colors.yellow}-p, --port <PORT>${colors.reset}    Port to listen on (default: ${DEFAULT_PORT})
  ${colors.yellow}-H, --host <IP>${colors.reset}      Bind host IP address (default: 127.0.0.1)
  ${colors.yellow}-n, --no-open${colors.reset}        Do not automatically launch web browser
  ${colors.yellow}-v, --version${colors.reset}        Print version information
  ${colors.yellow}-h, --help${colors.reset}           Print this help menu

${colors.bold}EXAMPLES:${colors.reset}
  ${colors.dim}# Start dashboard and auto-open browser on default port 9527${colors.reset}
  $ npx vibedesk

  ${colors.dim}# Start on custom port without opening browser${colors.reset}
  $ npx vibedesk -p 9999 --no-open

  ${colors.dim}# Check status of running daemon${colors.reset}
  $ npx vibedesk status
`);
}

function resolvePlatformBinaryName() {
  const platform = os.platform();
  const arch = os.arch();

  if (platform === 'darwin') {
    if (arch === 'arm64') return 'workstation-monitor-aarch64-apple-darwin';
    return 'workstation-monitor-x86_64-apple-darwin';
  } else if (platform === 'linux') {
    if (arch === 'arm64') return 'workstation-monitor-aarch64-unknown-linux-gnu';
    return 'workstation-monitor-x86_64-unknown-linux-gnu';
  }
  return null;
}

function findLocalBinary() {
  // 1. Check workspace release / debug builds if running inside repo
  const rootDir = path.resolve(__dirname, '..');
  const releaseBin = path.join(rootDir, 'target', 'release', 'workstation-monitor');
  if (fs.existsSync(releaseBin)) return releaseBin;

  const debugBin = path.join(rootDir, 'target', 'debug', 'workstation-monitor');
  if (fs.existsSync(debugBin)) return debugBin;

  // 2. Check cached binary in ~/.vibedesk/bin/v{VERSION}/workstation-monitor
  const cacheDir = path.join(os.homedir(), '.vibedesk', 'bin', `v${VERSION}`);
  const cachedBin = path.join(cacheDir, 'workstation-monitor');
  if (fs.existsSync(cachedBin)) return cachedBin;

  // 3. Check system PATH
  try {
    const whichPath = execSync('which workstation-monitor 2>/dev/null', { encoding: 'utf8' }).trim();
    if (whichPath && fs.existsSync(whichPath)) return whichPath;
  } catch (e) {}

  return null;
}

async function downloadBinary(targetFile) {
  const assetName = resolvePlatformBinaryName();
  if (!assetName) {
    throw new Error(`Unsupported platform/architecture: ${os.platform()}-${os.arch()}`);
  }

  const cacheDir = path.dirname(targetFile);
  fs.mkdirSync(cacheDir, { recursive: true });

  const downloadUrl = `https://github.com/${GITHUB_REPO}/releases/download/v${VERSION}/${assetName}`;
  const mirrorUrl = `https://ghproxy.net/${downloadUrl}`;

  console.log(`${colors.cyan}⬇️  Downloading VibeDesk standalone binary (v${VERSION}) for ${os.platform()}-${os.arch()}...${colors.reset}`);
  console.log(`${colors.dim}   Source: ${downloadUrl}${colors.reset}\n`);

  const downloadToFile = (url) => {
    return new Promise((resolve, reject) => {
      const followRedirect = (curUrl) => {
        const client = curUrl.startsWith('https') ? https : http;
        client.get(curUrl, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            followRedirect(res.headers.location);
            return;
          }
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP Download failed with status code ${res.statusCode}`));
            return;
          }

          const fileStream = fs.createWriteStream(targetFile);
          const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
          let receivedBytes = 0;

          res.on('data', (chunk) => {
            receivedBytes += chunk.length;
            if (totalBytes > 0) {
              const pct = Math.round((receivedBytes / totalBytes) * 100);
              process.stdout.write(`\r   [${pct}%] ${Math.round(receivedBytes / 1024 / 1024 * 10) / 10}MB / ${Math.round(totalBytes / 1024 / 1024 * 10) / 10}MB`);
            }
          });

          res.pipe(fileStream);
          fileStream.on('finish', () => {
            fileStream.close();
            process.stdout.write('\n');
            fs.chmodSync(targetFile, 0o755);
            resolve();
          });
          fileStream.on('error', (err) => {
            try { fs.unlinkSync(targetFile); } catch (e) {}
            reject(err);
          });
        }).on('error', reject);
      };

      followRedirect(url);
    });
  };

  try {
    await downloadToFile(downloadUrl);
  } catch (err) {
    console.log(`${colors.yellow}   Retrying via fast mirror CDN...${colors.reset}`);
    await downloadToFile(mirrorUrl);
  }

  console.log(`${colors.emerald}✅ Binary downloaded and cached successfully!${colors.reset}\n`);
}

async function ensureBinary() {
  let binPath = findLocalBinary();
  if (binPath) return binPath;

  const cacheDir = path.join(os.homedir(), '.vibedesk', 'bin', `v${VERSION}`);
  const targetFile = path.join(cacheDir, 'workstation-monitor');

  await downloadBinary(targetFile);
  return targetFile;
}

function checkDaemonStatus(port = DEFAULT_PORT) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/api/status`, { timeout: 1500 }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ running: true, data: json });
        } catch (e) {
          resolve({ running: false });
        }
      });
    });
    req.on('error', () => resolve({ running: false }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ running: false });
    });
  });
}

async function handleStatus(port = DEFAULT_PORT) {
  printBanner();
  console.log(`${colors.cyan}🔍 Checking VibeDesk daemon status on port ${port}...${colors.reset}`);
  const status = await checkDaemonStatus(port);
  if (status.running) {
    console.log(`
${colors.emerald}${colors.bold}● VibeDesk Daemon is ACTIVE & RUNNING${colors.reset}
  • Dashboard URL:  ${colors.cyan}http://localhost:${port}${colors.reset}
  • WebSocket Feed: ${colors.cyan}ws://localhost:${port}/ws${colors.reset}
  • Version:        ${status.data.version || VERSION}
  • Status:         ${status.data.status || 'healthy'}
  • Uptime:         ${Math.round((status.data.uptime_secs || 0) / 60)} minutes
`);
  } else {
    console.log(`
${colors.yellow}○ VibeDesk Daemon is NOT running on port ${port}.${colors.reset}
  Run ${colors.cyan}npx vibedesk${colors.reset} to start the dashboard.
`);
  }
}

async function handleStop(port = DEFAULT_PORT) {
  console.log(`${colors.yellow}🛑 Stopping VibeDesk daemon on port ${port}...${colors.reset}`);
  try {
    const pids = execSync(`lsof -ti :${port} 2>/dev/null`, { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
    if (pids.length > 0) {
      for (const pid of pids) {
        process.kill(parseInt(pid, 10), 'SIGTERM');
      }
      console.log(`${colors.emerald}✅ Successfully stopped VibeDesk process (PID: ${pids.join(', ')})${colors.reset}`);
    } else {
      console.log(`${colors.dim}No active process found listening on port ${port}.${colors.reset}`);
    }
  } catch (e) {
    console.log(`${colors.dim}No active process found listening on port ${port}.${colors.reset}`);
  }
}

function handleOpen(port = DEFAULT_PORT) {
  const url = `http://localhost:${port}`;
  console.log(`${colors.cyan}🌐 Opening ${url} in default browser...${colors.reset}`);
  try {
    if (os.platform() === 'darwin') {
      execSync(`open "${url}"`);
    } else if (os.platform() === 'win32') {
      execSync(`start "${url}"`);
    } else {
      execSync(`xdg-open "${url}"`);
    }
  } catch (e) {
    console.log(`${colors.dim}Please open ${url} in your browser.${colors.reset}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const firstArg = args[0];

  if (firstArg === '-h' || firstArg === '--help' || firstArg === 'help') {
    printHelp();
    process.exit(0);
  }

  if (firstArg === '-v' || firstArg === '--version' || firstArg === 'version') {
    console.log(`vibedesk v${VERSION} (workstation-monitor)`);
    process.exit(0);
  }

  if (firstArg === 'status') {
    const portArg = args[1] ? parseInt(args[1], 10) : DEFAULT_PORT;
    await handleStatus(portArg);
    process.exit(0);
  }

  if (firstArg === 'stop') {
    const portArg = args[1] ? parseInt(args[1], 10) : DEFAULT_PORT;
    await handleStop(portArg);
    process.exit(0);
  }

  if (firstArg === 'open') {
    const portArg = args[1] ? parseInt(args[1], 10) : DEFAULT_PORT;
    handleOpen(portArg);
    process.exit(0);
  }

  // Otherwise launch the server binary
  const binaryPath = await ensureBinary();

  const child = spawn(binaryPath, args, {
    stdio: 'inherit',
    env: process.env,
  });

  const forwardSignal = (sig) => {
    if (child.pid) {
      try {
        child.kill(sig);
      } catch (e) {}
    }
  };

  process.on('SIGINT', () => forwardSignal('SIGINT'));
  process.on('SIGTERM', () => forwardSignal('SIGTERM'));

  child.on('error', (err) => {
    console.error(`${colors.red}❌ Failed to start VibeDesk server:${colors.reset}`, err.message);
    process.exit(1);
  });

  child.on('exit', (code) => {
    process.exit(code || 0);
  });
}

main().catch((err) => {
  console.error(`${colors.red}Error:${colors.reset}`, err.message);
  process.exit(1);
});
