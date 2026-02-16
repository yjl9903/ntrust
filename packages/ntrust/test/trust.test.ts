import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/npm.ts', () => {
  return {
    checkNpmVersion: vi.fn(),
    getNpmCommand: vi.fn((args: string[], mise?: boolean) => {
      const tokens = mise ? ['mise', 'exec', 'npm@^11.10.0', '--', 'npm', ...args] : ['npm', ...args];
      return tokens;
    }),
    runNpm: vi.fn()
  };
});

vi.mock('../src/git.ts', () => {
  return {
    inferRepoInfo: vi.fn()
  };
});

import { checkNpmVersion, runNpm } from '../src/npm.ts';
import { inferRepoInfo } from '../src/git.ts';
import { listRelationships, revokeRelationships, trust } from '../src/trust.ts';

const checkNpmVersionMock = vi.mocked(checkNpmVersion);
const runNpmMock = vi.mocked(runNpm);
const inferRepoInfoMock = vi.mocked(inferRepoInfo);

function getRunNpmCalls() {
  return runNpmMock.mock.calls.map(([options]) => options);
}

describe('trust orchestration', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});

    checkNpmVersionMock.mockReset();
    runNpmMock.mockReset();
    inferRepoInfoMock.mockReset();

    checkNpmVersionMock.mockResolvedValue('11.10.0');
    inferRepoInfoMock.mockResolvedValue({
      provider: 'github',
      repo: 'acme/ntrust',
      file: 'release.yml'
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('passes env only to trust command and not to list/revoke', async () => {
    runNpmMock
      .mockResolvedValueOnce({
        command: ['npm', 'trust', 'list', '--json', 'pkg-a'],
        stdout: JSON.stringify({
          id: 'rel-1',
          type: 'github',
          file: 'legacy.yml',
          repository: 'acme/legacy'
        }),
        stderr: '',
        exitCode: 0
      })
      .mockResolvedValueOnce({
        command: ['npm', 'trust', 'revoke', '--id', 'rel-1', 'pkg-a'],
        stdout: '',
        stderr: '',
        exitCode: 0
      })
      .mockResolvedValueOnce({
        command: [
          'npm',
          'trust',
          'github',
          'pkg-a',
          '--repo',
          'acme/ntrust',
          '--file',
          'release.yml',
          '--yes',
          '--env',
          'production'
        ],
        stdout: '',
        stderr: '',
        exitCode: 0
      });

    await trust(['pkg-a'], {
      yes: true,
      env: 'production',
      dir: '/repo'
    });

    expect(getRunNpmCalls()).toMatchInlineSnapshot(`
      [
        {
          "args": [
            "trust",
            "list",
            "--json",
            "pkg-a",
          ],
          "cwd": "/repo",
          "mise": undefined,
        },
        {
          "args": [
            "trust",
            "revoke",
            "--id",
            "rel-1",
            "pkg-a",
          ],
          "cwd": "/repo",
          "mise": undefined,
          "stdio": "inherit",
        },
        {
          "args": [
            "trust",
            "github",
            "pkg-a",
            "--repo",
            "acme/ntrust",
            "--file",
            "release.yml",
            "--yes",
            "--env",
            "production",
          ],
          "cwd": "/repo",
          "mise": undefined,
          "stdio": "inherit",
        },
      ]
    `);
    expect(runNpmMock).toHaveBeenCalledTimes(3);
  });

  it('stops on first failing package', async () => {
    runNpmMock
      .mockResolvedValueOnce({
        command: ['npm', 'trust', 'list', '--json', 'pkg-a'],
        stdout: '',
        stderr: '',
        exitCode: 0
      })
      .mockResolvedValueOnce({
        command: ['npm', 'trust', 'github', 'pkg-a', '--repo', 'acme/ntrust', '--file', 'release.yml', '--yes'],
        stdout: '',
        stderr: '',
        exitCode: 0
      })
      .mockResolvedValueOnce({
        command: ['npm', 'trust', 'list', '--json', 'pkg-b'],
        stdout: '',
        stderr: '',
        exitCode: 0
      })
      .mockRejectedValueOnce(new Error('package failed'));

    await expect(
      trust(['pkg-a', 'pkg-b', 'pkg-c'], {
        yes: true
      })
    ).rejects.toThrowErrorMatchingInlineSnapshot(`[Error: package failed]`);

    expect(getRunNpmCalls()).toMatchInlineSnapshot(`
      [
        {
          "args": [
            "trust",
            "list",
            "--json",
            "pkg-a",
          ],
          "cwd": undefined,
          "mise": undefined,
        },
        {
          "args": [
            "trust",
            "github",
            "pkg-a",
            "--repo",
            "acme/ntrust",
            "--file",
            "release.yml",
            "--yes",
          ],
          "cwd": undefined,
          "mise": undefined,
          "stdio": "inherit",
        },
        {
          "args": [
            "trust",
            "list",
            "--json",
            "pkg-b",
          ],
          "cwd": undefined,
          "mise": undefined,
        },
        {
          "args": [
            "trust",
            "github",
            "pkg-b",
            "--repo",
            "acme/ntrust",
            "--file",
            "release.yml",
            "--yes",
          ],
          "cwd": undefined,
          "mise": undefined,
          "stdio": "inherit",
        },
      ]
    `);
    expect(runNpmMock).toHaveBeenCalledTimes(4);
  });

  it('revokeRelationships uses list json then revoke and never passes env', async () => {
    runNpmMock
      .mockResolvedValueOnce({
        command: ['npm', 'trust', 'list', '--json', 'pkg-a'],
        stdout: JSON.stringify({
          id: 'rel-1',
          type: 'github',
          file: 'release.yml',
          repository: 'acme/ntrust'
        }),
        stderr: '',
        exitCode: 0
      })
      .mockResolvedValueOnce({
        command: ['npm', 'trust', 'revoke', '--id', 'rel-1', 'pkg-a'],
        stdout: '',
        stderr: '',
        exitCode: 0
      });

    const result = await revokeRelationships(['pkg-a'], {
      yes: true,
      env: 'production'
    });

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "command": [
            "npm",
            "trust",
            "revoke",
            "--id",
            "rel-1",
            "pkg-a",
          ],
          "package": "pkg-a",
          "status": "success",
          "stdout": "",
        },
      ]
    `);
    expect(getRunNpmCalls()).toMatchInlineSnapshot(`
      [
        {
          "args": [
            "trust",
            "list",
            "--json",
            "pkg-a",
          ],
          "cwd": undefined,
          "mise": undefined,
        },
        {
          "args": [
            "trust",
            "revoke",
            "--id",
            "rel-1",
            "pkg-a",
          ],
          "cwd": undefined,
          "mise": undefined,
          "stdio": "inherit",
        },
      ]
    `);
    expect(runNpmMock).toHaveBeenCalledTimes(2);
  });

  it('list supports dry-run with json command and no npm execution', async () => {
    const result = await listRelationships(['pkg-a'], {
      dryRun: true
    });

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "command": [
            "npm",
            "trust",
            "list",
            "--json",
            "pkg-a",
          ],
          "package": "pkg-a",
          "status": "dry-run",
        },
      ]
    `);
    expect(runNpmMock).not.toHaveBeenCalled();
  });

  it('skips package when existing relationship already matches target repo and workflow', async () => {
    runNpmMock.mockResolvedValueOnce({
      command: ['npm', 'trust', 'list', '--json', 'pkg-a'],
      stdout: JSON.stringify({
        id: 'rel-1',
        type: 'github',
        file: 'release.yml',
        repository: 'acme/ntrust'
      }),
      stderr: '',
      exitCode: 0
    });

    const result = await trust(['pkg-a'], { yes: true });

    expect(result).toMatchInlineSnapshot(`[]`);
    expect(getRunNpmCalls()).toMatchInlineSnapshot(`
      [
        {
          "args": [
            "trust",
            "list",
            "--json",
            "pkg-a",
          ],
          "cwd": undefined,
          "mise": undefined,
        },
      ]
    `);
    expect(runNpmMock).toHaveBeenCalledTimes(1);
  });

  it('revokes existing mismatched relationship before creating a new one', async () => {
    runNpmMock
      .mockResolvedValueOnce({
        command: ['npm', 'trust', 'list', '--json', 'pkg-a'],
        stdout: JSON.stringify({
          id: 'rel-old',
          type: 'github',
          file: 'legacy.yml',
          repository: 'acme/legacy'
        }),
        stderr: '',
        exitCode: 0
      })
      .mockResolvedValueOnce({
        command: ['npm', 'trust', 'revoke', '--id', 'rel-old', 'pkg-a'],
        stdout: '',
        stderr: '',
        exitCode: 0
      })
      .mockResolvedValueOnce({
        command: ['npm', 'trust', 'github', 'pkg-a', '--repo', 'acme/ntrust', '--file', 'release.yml', '--yes'],
        stdout: '',
        stderr: '',
        exitCode: 0
      });

    await trust(['pkg-a'], { yes: true });

    expect(getRunNpmCalls()).toMatchInlineSnapshot(`
      [
        {
          "args": [
            "trust",
            "list",
            "--json",
            "pkg-a",
          ],
          "cwd": undefined,
          "mise": undefined,
        },
        {
          "args": [
            "trust",
            "revoke",
            "--id",
            "rel-old",
            "pkg-a",
          ],
          "cwd": undefined,
          "mise": undefined,
          "stdio": "inherit",
        },
        {
          "args": [
            "trust",
            "github",
            "pkg-a",
            "--repo",
            "acme/ntrust",
            "--file",
            "release.yml",
            "--yes",
          ],
          "cwd": undefined,
          "mise": undefined,
          "stdio": "inherit",
        },
      ]
    `);
  });

  it('list fallback retries with inherit then pipe after first failure', async () => {
    runNpmMock
      .mockRejectedValueOnce(new Error('EOTP required'))
      .mockResolvedValueOnce({
        command: ['npm', 'trust', 'list', '--json', 'pkg-a'],
        stdout: '',
        stderr: '',
        exitCode: 0
      })
      .mockResolvedValueOnce({
        command: ['npm', 'trust', 'list', '--json', 'pkg-a'],
        stdout: JSON.stringify({
          id: 'rel-1',
          type: 'github',
          file: 'release.yml',
          repository: 'acme/ntrust'
        }),
        stderr: '',
        exitCode: 0
      });

    const result = await listRelationships(['pkg-a'], {});
    const normalizedResult = result.map((item) => ({
      ...item,
      stdout: item.stdout ? JSON.parse(item.stdout) : item.stdout
    }));

    expect(normalizedResult).toMatchInlineSnapshot(`
      [
        {
          "command": [
            "npm",
            "trust",
            "list",
            "--json",
            "pkg-a",
          ],
          "json": {
            "file": "release.yml",
            "id": "rel-1",
            "repository": "acme/ntrust",
            "type": "github",
          },
          "package": "pkg-a",
          "status": "success",
          "stdout": {
            "file": "release.yml",
            "id": "rel-1",
            "repository": "acme/ntrust",
            "type": "github",
          },
        },
      ]
    `);
    expect(getRunNpmCalls()).toMatchInlineSnapshot(`
      [
        {
          "args": [
            "trust",
            "list",
            "--json",
            "pkg-a",
          ],
          "cwd": undefined,
          "mise": undefined,
        },
        {
          "args": [
            "trust",
            "list",
            "--json",
            "pkg-a",
          ],
          "cwd": undefined,
          "mise": undefined,
          "stdio": "inherit",
        },
        {
          "args": [
            "trust",
            "list",
            "--json",
            "pkg-a",
          ],
          "cwd": undefined,
          "mise": undefined,
        },
      ]
    `);
    expect(runNpmMock).toHaveBeenCalledTimes(3);
  });
});
