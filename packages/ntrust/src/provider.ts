import type { TrustOptions } from './types.ts';

export interface RepoInfo {
  provider: 'github' | 'gitlab';

  repo: string;

  file: string;
}

/**
 * Infer repo info:
 * - provider: github or gitlab
 * - remote repo: i.e. yjl9903/ntrust
 * - workflow file: i.e. release.yml
 */
export function inferRepoInfo(options: TrustOptions) {
  // TODO
}
