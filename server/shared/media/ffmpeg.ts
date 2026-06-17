import { spawn } from 'node:child_process';

const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg';
const FFPROBE_PATH = process.env.FFPROBE_PATH || 'ffprobe';

function runBinary(binary: string, args: string[], timeoutMs?: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    const timer = timeoutMs
      ? setTimeout(() => {
          child.kill('SIGKILL');
          reject(new Error(`${binary} timed out after ${timeoutMs}ms`));
        }, timeoutMs)
      : undefined;

    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    child.on('error', (error) => {
      if (timer) clearTimeout(timer);
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(
          new Error(
            `Unable to find ${binary}. Install ffmpeg on the server or set ${binary === FFMPEG_PATH ? 'FFMPEG_PATH' : 'FFPROBE_PATH'} to the full binary path.`
          )
        );
        return;
      }
      reject(error);
    });

    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${binary} exited with code ${code}: ${stderr}`));
    });
  });
}

function runBinaryWithOutput(binary: string, args: string[], timeoutMs?: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = timeoutMs
      ? setTimeout(() => {
          child.kill('SIGKILL');
          reject(new Error(`${binary} timed out after ${timeoutMs}ms`));
        }, timeoutMs)
      : undefined;

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', (error) => {
      if (timer) clearTimeout(timer);
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(
          new Error(
            `Unable to find ${binary}. Install ffmpeg on the server or set ${binary === FFMPEG_PATH ? 'FFMPEG_PATH' : 'FFPROBE_PATH'} to the full binary path.`
          )
        );
        return;
      }
      reject(error);
    });
    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(new Error(`${binary} exited with code ${code}: ${stderr}`));
    });
  });
}

export function runFfmpeg(args: string[], timeoutMs?: number): Promise<void> {
  return runBinary(FFMPEG_PATH, args, timeoutMs);
}

export function runFfprobeWithOutput(args: string[], timeoutMs?: number): Promise<string> {
  return runBinaryWithOutput(FFPROBE_PATH, args, timeoutMs);
}

export function runFfmpegWithStderrOutput(args: string[], timeoutMs?: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(FFMPEG_PATH, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    const timer = timeoutMs
      ? setTimeout(() => {
          child.kill('SIGKILL');
          reject(new Error(`${FFMPEG_PATH} timed out after ${timeoutMs}ms`));
        }, timeoutMs)
      : undefined;

    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', (error) => {
      if (timer) clearTimeout(timer);
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(
          new Error(
            `Unable to find ${FFMPEG_PATH}. Install ffmpeg on the server or set FFMPEG_PATH to the full binary path.`
          )
        );
        return;
      }
      reject(error);
    });
    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      if (code === 0) {
        resolve(stderr);
        return;
      }
      reject(new Error(`${FFMPEG_PATH} exited with code ${code}: ${stderr}`));
    });
  });
}

export function getFfmpegPath(): string {
  return FFMPEG_PATH;
}
