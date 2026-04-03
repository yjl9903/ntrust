export interface PackageRepositoryObject {
  type?: string;
  url?: string;
}

export type PackageRepository = string | PackageRepositoryObject;

export function getPackageRepositoryUrl(repository?: PackageRepository): string | undefined {
  if (typeof repository === 'string') {
    const value = repository.trim();
    return value.length > 0 ? value : undefined;
  }

  if (repository && typeof repository.url === 'string') {
    const value = repository.url.trim();
    return value.length > 0 ? value : undefined;
  }

  return undefined;
}

function normalizeRepositoryPath(value: string): string {
  return value
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .replace(/\.git$/i, '')
    .trim();
}

export function normalizeRepositoryReference(value: string): string {
  const input = value.trim();
  if (input.length === 0) {
    throw new Error('Repository value is empty.');
  }

  const withoutFragment = input.replace(/#.*$/, '');
  const normalizedInput = withoutFragment.replace(/^git\+/, '');

  const githubShorthand = normalizedInput.match(/^github:(.+)$/i);
  if (githubShorthand) {
    return normalizeRepositoryPath(githubShorthand[1]);
  }

  if (/^[^/:@\s]+\/[^/:@\s]+$/.test(normalizedInput)) {
    return normalizeRepositoryPath(normalizedInput);
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(normalizedInput)) {
    const url = new URL(normalizedInput);
    return normalizeRepositoryPath(url.pathname);
  }

  const sshLikeMatch = normalizedInput.match(/^(?:[^@/\s]+@)?[^:/\s]+:(.+)$/);
  if (sshLikeMatch) {
    return normalizeRepositoryPath(sshLikeMatch[1]);
  }

  throw new Error(`Unsupported repository value: ${value}`);
}
