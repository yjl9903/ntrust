import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('execa', () => {
  return {
    execa: vi.fn()
  };
});

import { execa } from 'execa';

import { checkNpmVersion, runNpm } from '../src/npm.ts';

const execaMock = execa as unknown as {
  mockReset: () => void;
  mockResolvedValue: (value: unknown) => void;
  mockImplementation: (implementation: (...args: unknown[]) => unknown) => void;
  mock: { calls: unknown[][] };
};

describe('runNpm', () => {
  beforeEach(() => {
    execaMock.mockReset();
  });

  it('checks the npm version through mise using the latest release', async () => {
    execaMock.mockResolvedValue({
      stdout: '12.2.0\n',
      stderr: '',
      exitCode: 0
    });

    await expect(checkNpmVersion({ cwd: '/workspace', mise: true })).resolves.toBe('12.2.0');

    expect(execa).toHaveBeenCalledWith(
      'mise',
      ['exec', 'npm@latest', '--', 'npm', '--version', '--loglevel=error'],
      { cwd: '/workspace', stdio: 'pipe' }
    );
  });

  it('rejects an npm version below the minimum even when using mise', async () => {
    execaMock.mockResolvedValue({ stdout: '11.12.1\n', stderr: '', exitCode: 0 });

    await expect(checkNpmVersion({ mise: true })).rejects.toThrow(
      'npm version 11.13.0 or newer is required, but got 11.12.1'
    );
  });

  it('uses pipe stdio by default', async () => {
    execaMock.mockResolvedValue({
      stdout: 'ok',
      stderr: '',
      exitCode: 0
    });

    await runNpm({
      args: ['trust', 'list', 'pkg-a']
    });

    expect(execaMock.mock.calls[0]).toMatchInlineSnapshot(`
      [
        "npm",
        [
          "trust",
          "list",
          "pkg-a",
          "--loglevel=error",
        ],
        {
          "cwd": undefined,
          "stdio": "pipe",
        },
      ]
    `);
  });

  it('supports inheriting stdio for tty passthrough', async () => {
    execaMock.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0
    });

    await runNpm({
      args: ['publish'],
      stdio: 'inherit'
    });

    expect(execaMock.mock.calls[0]).toMatchInlineSnapshot(`
      [
        "npm",
        [
          "publish",
          "--loglevel=error",
        ],
        {
          "cwd": undefined,
          "stdio": "inherit",
        },
      ]
    `);
  });
});
