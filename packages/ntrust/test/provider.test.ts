import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('execa', () => {
  return {
    execa: vi.fn()
  };
});

import { execa } from 'execa';

import { inferRepoInfo } from '../src/git.ts';

const execaMock = execa as unknown as {
  mockReset: () => void;
  mockImplementation: (
    implementation: (command: string, args: string[]) => Promise<unknown>
  ) => void;
};

async function createTempRepo(): Promise<string> {
  return await mkdtemp(path.join(tmpdir(), 'ntrust-provider-'));
}

describe('inferRepoInfo', () => {
  const tempDirs: string[] = [];

  beforeEach(() => {
    execaMock.mockReset();
  });

  afterEach(async () => {
    for (const dir of tempDirs) {
      await rm(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it('auto-detects workflow file when there is exactly one publish command', async () => {
    const root = await createTempRepo();
    tempDirs.push(root);

    await mkdir(path.join(root, '.github', 'workflows'), { recursive: true });
    await writeFile(
      path.join(root, '.github', 'workflows', 'ci.yml'),
      ['name: CI', 'jobs:', '  ci:', '    steps:', '      - run: pnpm test:ci'].join('\n')
    );
    await writeFile(
      path.join(root, '.github', 'workflows', 'release.yml'),
      [
        'name: Release',
        'jobs:',
        '  release:',
        '    steps:',
        '      - run: pnpm -r publish --provenance --no-git-checks'
      ].join('\n')
    );

    execaMock.mockImplementation(async (command, args) => {
      if (command === 'git' && args[0] === 'rev-parse') {
        return { stdout: root, stderr: '', exitCode: 0 };
      }
      if (command === 'git' && args[0] === 'remote') {
        return { stdout: 'git@github.com:acme/ntrust.git', stderr: '', exitCode: 0 };
      }
      throw new Error(`Unexpected command: ${command} ${args.join(' ')}`);
    });

    const result = await inferRepoInfo({ dir: root });
    expect(result).toMatchInlineSnapshot(`
      {
        "file": "release.yml",
        "provider": "github",
        "repo": "acme/ntrust",
      }
    `);
  });

  it('prefers manually provided workflow file', async () => {
    const root = await createTempRepo();
    tempDirs.push(root);

    execaMock.mockImplementation(async (command, args) => {
      if (command === 'git' && args[0] === 'rev-parse') {
        return { stdout: root, stderr: '', exitCode: 0 };
      }
      throw new Error(`Unexpected command: ${command} ${args.join(' ')}`);
    });

    const result = await inferRepoInfo({
      dir: root,
      provider: 'github',
      repo: 'acme/ntrust',
      file: 'manual.yml'
    });
    expect(result).toMatchInlineSnapshot(`
      {
        "file": "manual.yml",
        "provider": "github",
        "repo": "acme/ntrust",
      }
    `);
  });

  it('throws when no workflow publish command is found', async () => {
    const root = await createTempRepo();
    tempDirs.push(root);

    await mkdir(path.join(root, '.github', 'workflows'), { recursive: true });
    await writeFile(
      path.join(root, '.github', 'workflows', 'ci.yml'),
      ['name: CI', 'jobs:', '  ci:', '    steps:', '      - run: pnpm test:ci'].join('\n')
    );

    execaMock.mockImplementation(async (command, args) => {
      if (command === 'git' && args[0] === 'rev-parse') {
        return { stdout: root, stderr: '', exitCode: 0 };
      }
      if (command === 'git' && args[0] === 'remote') {
        return { stdout: 'https://github.com/acme/ntrust.git', stderr: '', exitCode: 0 };
      }
      throw new Error(`Unexpected command: ${command} ${args.join(' ')}`);
    });

    await expect(inferRepoInfo({ dir: root })).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: Unable to find any workflow. Please specify --file manually.]`
    );
  });

  it('throws when multiple workflow publish commands are found', async () => {
    const root = await createTempRepo();
    tempDirs.push(root);

    await mkdir(path.join(root, '.github', 'workflows'), { recursive: true });
    await writeFile(
      path.join(root, '.github', 'workflows', 'release-a.yml'),
      ['jobs:', '  release:', '    steps:', '      - run: npm publish'].join('\n')
    );
    await writeFile(
      path.join(root, '.github', 'workflows', 'release-b.yml'),
      ['jobs:', '  release:', '    steps:', '      - run: pnpm -r publish'].join('\n')
    );

    execaMock.mockImplementation(async (command, args) => {
      if (command === 'git' && args[0] === 'rev-parse') {
        return { stdout: root, stderr: '', exitCode: 0 };
      }
      if (command === 'git' && args[0] === 'remote') {
        return { stdout: 'https://github.com/acme/ntrust.git', stderr: '', exitCode: 0 };
      }
      throw new Error(`Unexpected command: ${command} ${args.join(' ')}`);
    });

    await expect(inferRepoInfo({ dir: root })).rejects.toThrowErrorMatchingInlineSnapshot(`
      [Error: Found multiple publish workflow commands in GitHub actions. Please specify --file manually.
      - release-a.yml (job=release, step=1): npm publish
      - release-b.yml (job=release, step=1): pnpm -r publish]
    `);
  });
});
