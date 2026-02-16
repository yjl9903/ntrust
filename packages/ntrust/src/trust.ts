import type { TrustOptions } from './types.ts';

/**
 * 1. Check npm version >= 11.10.0
 * 2. Infer repo info
 * 3. Print all the inferred info, and waiting for confirm
 * 4. Run npm trust
 *
 * @param packages package names to be managed
 * @param options
 */
export async function trust(packages: string[], options: TrustOptions) {
  // TODO
}

/**
 * 1. Check npm version >= 11.10.0
 * 2. Run npm trust list
 * 3. Print trust list
 *
 * @param packages package names to be managed
 * @param options
 */
export async function listRelationships(packages: string[], options: TrustOptions) {
  // TODO
}

/**
 * 1. Check npm version >= 11.10.0
 * 2. Run npm trust list
 * 3. Print trust list and waiting for confirm
 * 4. Run npm trust revoke
 *
 * @param packages package names to be managed
 * @param options
 */
export async function revokeRelationships(packages: string[], options: TrustOptions) {
  // TODO
}
