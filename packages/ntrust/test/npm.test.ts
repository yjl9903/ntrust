import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('execa', () => {
  return {
    execa: vi.fn()
  };
});

import { execa } from 'execa';

import { runNpm } from '../src/npm.ts';

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
