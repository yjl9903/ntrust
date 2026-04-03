import { describe, expect, it } from 'vitest';

import { normalizeRepositoryReference } from '../src/repository.ts';

describe('normalizeRepositoryReference', () => {
  it('supports common GitHub repository formats', () => {
    expect(normalizeRepositoryReference('git+https://github.com/acme/ntrust.git')).toBe(
      'acme/ntrust'
    );
    expect(normalizeRepositoryReference('git@github.com:acme/ntrust.git')).toBe('acme/ntrust');
    expect(normalizeRepositoryReference('github:acme/ntrust')).toBe('acme/ntrust');
    expect(normalizeRepositoryReference('acme/ntrust')).toBe('acme/ntrust');
  });

  it('throws on unsupported repository values', () => {
    expect(() => normalizeRepositoryReference('not a repo')).toThrowErrorMatchingInlineSnapshot(
      `[Error: Unsupported repository value: not a repo]`
    );
  });
});
