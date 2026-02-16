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
): Promise<{ packages: string[] }> {
  // TODO

  return { packages: [] };
}
