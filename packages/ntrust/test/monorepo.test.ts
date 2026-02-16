import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { findPackages } from '../src/monorepo.ts';

async function createTempRepo(): Promise<string> {
  return await mkdtemp(path.join(tmpdir(), 'ntrust-monorepo-'));
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(data, null, 2));
}

describe('findPackages', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    for (const dir of tempDirs) {
      await rm(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it('auto-discovers pnpm workspace packages and filters private/missing-name packages', async () => {
    const root = await createTempRepo();
    tempDirs.push(root);

    await writeFile(path.join(root, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n');
    await writeJson(path.join(root, 'packages', 'public-a', 'package.json'), {
      name: '@scope/public-a',
      version: '1.0.0'
    });
    await writeJson(path.join(root, 'packages', 'private-a', 'package.json'), {
      name: '@scope/private-a',
      private: true
    });
    await writeJson(path.join(root, 'packages', 'no-name', 'package.json'), {
      version: '1.0.0'
    });

    const result = await findPackages(root, []);
    expect(result.packages).toMatchInlineSnapshot(`
      [
        "@scope/public-a",
      ]
    `);
  });

  it('prefers explicit files over workspace auto-discovery', async () => {
    const root = await createTempRepo();
    tempDirs.push(root);

    await writeFile(path.join(root, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n');
    await writeJson(path.join(root, 'packages', 'workspace-a', 'package.json'), {
      name: '@scope/workspace-a'
    });
    await writeJson(path.join(root, 'custom', 'package.json'), {
      name: '@scope/custom'
    });

    const result = await findPackages(root, ['custom']);
    expect(result.packages).toMatchInlineSnapshot(`
      [
        "@scope/custom",
      ]
    `);
  });

  it('throws when all discovered packages are filtered out', async () => {
    const root = await createTempRepo();
    tempDirs.push(root);

    await writeFile(path.join(root, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n');
    await writeJson(path.join(root, 'packages', 'private-a', 'package.json'), {
      name: '@scope/private-a',
      private: true
    });
    await writeJson(path.join(root, 'packages', 'no-name', 'package.json'), {
      version: '1.0.0'
    });

    let message = '';

    try {
      await findPackages(root, []);
    } catch (error) {
      message = (error as Error).message.replaceAll(root, '<ROOT>');
    }

    expect(message).toMatchInlineSnapshot(`
      "No publishable package found.
       Filtered package.json files:
      - <ROOT>/packages/private-a/package.json (private=true)
      - <ROOT>/packages/no-name/package.json (missing name)"
    `);
  });
});
