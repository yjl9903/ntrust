import { execa } from 'execa';

export const MIN_NPM_VERSION = '11.10.0';

export interface RunNpmOptions {
  args: string[];
  cwd?: string;
  mise?: boolean;
  stdio?: 'pipe' | 'inherit';
}

export interface RunNpmResult {
  command: string[];
  stdout: string;
  stderr: string;
  exitCode: number;
}

export function getNpmCommand(args: string[], mise?: boolean) {
  const tokens = mise ? ['mise', 'exec', 'npm@^11.10.0', '--', 'npm', ...args] : ['npm', ...args];
  return tokens;
}

export async function runNpm(options: RunNpmOptions): Promise<RunNpmResult> {
  const { args, cwd, mise, stdio = 'pipe' } = options;
  const command = getNpmCommand(args, mise);

  try {
    const result = await execa(command[0], [...command.slice(1), '--loglevel=error'], {
      cwd,
      stdio
    });

    return {
      command,
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
      exitCode: result.exitCode ?? 0
    };
  } catch (error) {
    const details = error as {
      shortMessage?: string;
      stderr?: string;
      stdout?: string;
      exitCode?: number;
    };

    const message = details.stderr || details.shortMessage || details.stdout || 'Unknown npm error';

    throw new Error(
      `Failed to run command "${command.join(' ')}" (exit=${details.exitCode ?? 'unknown'})\n${message}`
    );
  }
}

function parseVersion(version: string): [number, number, number] | null {
  const match = version.trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    return null;
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareVersion(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) {
    throw new Error(`Invalid semantic version comparison: "${a}" vs "${b}"`);
  }

  for (let index = 0; index < 3; index++) {
    if (pa[index] > pb[index]) {
      return 1;
    }
    if (pa[index] < pb[index]) {
      return -1;
    }
  }

  return 0;
}

export async function checkNpmVersion(
  options?: Pick<RunNpmOptions, 'cwd' | 'mise'>
): Promise<string> {
  const result = await runNpm({
    args: ['--version'],
    cwd: options?.cwd,
    mise: options?.mise
  });

  const npmVersion = result.stdout.trim();
  if (compareVersion(npmVersion, MIN_NPM_VERSION) < 0) {
    throw new Error(
      `npm version ${MIN_NPM_VERSION} or newer is required, but got ${npmVersion}. Please upgrade npm first.`
    );
  }

  return npmVersion;
}
