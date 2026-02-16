import type { TrustOptions } from './types.ts';

import { execa } from 'execa';

import { inferGithubWorkflowFile } from './github.ts';

export interface RepoInfo {
  provider: 'github' | 'gitlab';

  repo: string;

  file: string;
}

function normalizeRepoPath(value: string): string {
  return value
    .replace(/^\/+/, '')
    .replace(/\.git$/, '')
    .trim();
}

function parseRepoFromRemote(remote: string): string {
  const sshMatch = remote.match(/^[^@]+@[^:]+:(.+?)(?:\.git)?$/);
  if (sshMatch) {
    return normalizeRepoPath(sshMatch[1]);
  }

  const urlMatch = remote.match(/^[a-z]+:\/\/[^/]+\/(.+?)(?:\.git)?$/i);
  if (urlMatch) {
    return normalizeRepoPath(urlMatch[1]);
  }

  throw new Error(`Unable to parse repository from git remote: ${remote}`);
}

async function getRepoRoot(cwd: string): Promise<string> {
  try {
    const result = await execa('git', ['rev-parse', '--show-toplevel'], { cwd });
    return result.stdout.trim();
  } catch {
    return cwd;
  }
}

async function getOriginRemote(cwd: string): Promise<string> {
  const result = await execa('git', ['remote', 'get-url', 'origin'], { cwd });
  return result.stdout.trim();
}

function inferProviderFromRemote(remote: string): 'github' | 'gitlab' {
  if (remote.includes('github.com')) {
    return 'github';
  }
  if (remote.includes('gitlab')) {
    return 'gitlab';
  }
  throw new Error(`Unable to infer provider from remote URL: ${remote}`);
}

/**
 * Infer repo info:
 * - provider: github or gitlab
 * - remote repo: i.e. yjl9903/ntrust
 * - workflow file: i.e. release.yml
 */
export async function inferRepoInfo(options: TrustOptions): Promise<RepoInfo> {
  const cwd = options.dir ?? process.cwd();
  const repoRoot = await getRepoRoot(cwd);

  const remote = !options.provider || !options.repo ? await getOriginRemote(repoRoot) : undefined;

  const provider = options.provider ?? inferProviderFromRemote(remote ?? '');
  if (provider === 'gitlab') {
    throw new Error('GitLab provider is not implemented yet.');
  }

  const repo = options.repo ?? parseRepoFromRemote(remote ?? '');
  const segments = repo.split('/').filter(Boolean);
  if (segments.length !== 2) {
    throw new Error(`Expected GitHub repository to be "owner/name", but got "${repo}".`);
  }

  const file =
    options.file ?? (provider === 'github' ? await inferGithubWorkflowFile(repoRoot) : undefined);
  if (!file) {
    throw new Error('Unable to find any workflow. Please specify --file manually.');
  }

  return {
    provider,
    repo,
    file
  };
}
