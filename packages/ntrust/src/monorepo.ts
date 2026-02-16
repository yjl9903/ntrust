import path from 'node:path';
import { glob, readFile, stat } from 'node:fs/promises';

import yaml from 'js-yaml';

interface PackageManifest {
  name?: string;
  private?: boolean;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function toPackageJsonFiles(rootDir: string, entry: string): Promise<string[]> {
  const matches: string[] = [];

  for await (const matched of glob(entry, { cwd: rootDir })) {
    const absolute = path.resolve(rootDir, matched);
    if (absolute.includes(`${path.sep}node_modules${path.sep}`)) {
      continue;
    }
    matches.push(absolute);
  }

  if (matches.length === 0) {
    const absolute = path.resolve(rootDir, entry);
    if (await exists(absolute)) {
      matches.push(absolute);
    }
  }

  const normalized: string[] = [];
  for (const matched of matches) {
    const matchedStat = await stat(matched);

    if (matchedStat.isDirectory()) {
      normalized.push(path.join(matched, 'package.json'));
      continue;
    }

    if (path.basename(matched) === 'package.json') {
      normalized.push(matched);
      continue;
    }
  }

  return normalized;
}

async function discoverPnpmWorkspacePackageJsonFiles(
  rootDir: string
): Promise<string[] | undefined> {
  const workspacePath = path.join(rootDir, 'pnpm-workspace.yaml');
  if (!(await exists(workspacePath))) {
    return undefined;
  }

  const content = await readFile(workspacePath, 'utf8');
  const workspace = yaml.load(content) as { packages?: unknown };
  if (!workspace || !Array.isArray(workspace.packages)) {
    return undefined;
  }

  const packageJsonFiles: string[] = [];

  for (const pattern of workspace.packages) {
    if (typeof pattern !== 'string') {
      continue;
    }

    const packageJsonPattern = pattern.endsWith('/package.json')
      ? pattern
      : `${pattern.replace(/\/+$/, '')}/package.json`;

    for await (const matched of glob(packageJsonPattern, { cwd: rootDir })) {
      const absolute = path.resolve(rootDir, matched);
      if (absolute.includes(`${path.sep}node_modules${path.sep}`)) {
        continue;
      }
      packageJsonFiles.push(absolute);
    }
  }

  return packageJsonFiles;
}

async function readManifest(packageJsonPath: string): Promise<PackageManifest | undefined> {
  try {
    const content = await readFile(packageJsonPath, 'utf8');
    return JSON.parse(content) as PackageManifest;
  } catch {
    return undefined;
  }
}

/**
 * Find packages to be managed
 * It will appreciate famous monorepo manage tools, including pnpm
 *
 * @param dir defaults to cwd
 * @param files specify package.json files, supports glob pattern
 */
export async function findPackages(
  dir: string | undefined,
  files: string[]
): Promise<{ packages: string[]; skipped: string[] }> {
  const rootDir = path.resolve(dir ?? process.cwd());
  const packageJsonFiles: string[] = [];

  if (files.length > 0) {
    for (const file of files) {
      const resolvedFiles = await toPackageJsonFiles(rootDir, file);
      packageJsonFiles.push(...resolvedFiles);
    }
  } else {
    const pnpmWorkspaces = await discoverPnpmWorkspacePackageJsonFiles(rootDir);
    if (pnpmWorkspaces) {
      packageJsonFiles.push(...pnpmWorkspaces);
    } else {
      const resolvedFiles = await toPackageJsonFiles(rootDir, './package.json');
      packageJsonFiles.push(...resolvedFiles);
    }
  }

  const uniquePackageJsonFiles = [...new Set(packageJsonFiles)];

  const packages: string[] = [];
  const seenPackageNames = new Set<string>();
  const skipped: string[] = [];

  for (const packageJsonFile of uniquePackageJsonFiles) {
    const manifest = await readManifest(packageJsonFile);
    if (!manifest) continue;

    if (manifest.private === true) {
      skipped.push(`${packageJsonFile} (private=true)`);
      continue;
    }

    if (!manifest.name || manifest.name.trim().length === 0) {
      skipped.push(`${packageJsonFile} (missing name)`);
      continue;
    }

    if (seenPackageNames.has(manifest.name)) {
      continue;
    }

    seenPackageNames.add(manifest.name);
    packages.push(manifest.name);
  }

  if (packages.length === 0) {
    const details =
      skipped.length > 0 ? ` Filtered package.json files:\n- ${skipped.join('\n- ')}` : '';
    throw new Error('No publishable package found.\n' + details);
  }

  packages.sort((lhs, rhs) => {
    const lscope = lhs.startsWith('@') ? 0 : 1;
    const rscope = rhs.startsWith('@') ? 0 : 1;
    if (lscope !== rscope) return lscope - rscope;
    return lhs.localeCompare(rhs);
  });

  return { packages, skipped };
}
