import { dim, lightGreen } from 'breadc';

import type { TrustOptions } from './types.ts';
import type { PackageJson } from './monorepo.ts';

import { confirm } from './tui.ts';
import { inferRepoInfo } from './git.ts';
import { checkNpmVersion, getNpmCommand, runNpm } from './npm.ts';
import { normalizeRepositoryReference } from './repository.ts';

export interface CommandExecutionResult<T = any> {
  package: string;
  command: string[];
  status: 'success' | 'dry-run';
  stdout?: string;
  json?: T;
}

export interface ListResult {
  id: string;
  type: string;
  file: string;
  repository: string;
  allowPublish?: boolean;
  allowStagePublish?: boolean;
}

function getPackageTargets(packages: string[], options: TrustOptions): PackageJson[] {
  const packageJsonByName = new Map(
    (options.packageJsons ?? []).map((packageJson) => [packageJson.name, packageJson])
  );

  return packages.map((packageName) => {
    return (
      packageJsonByName.get(packageName) ?? {
        name: packageName,
        packageJsonPath: ''
      }
    );
  });
}

function validateRepositoryAlignment(targets: PackageJson[], expectedRepo: string): void {
  const manifestBackedTargets = targets.filter((target) => target.packageJsonPath.length > 0);
  if (manifestBackedTargets.length === 0) {
    return;
  }

  const errors: string[] = [];

  for (const target of manifestBackedTargets) {
    if (!target.repositoryUrl) {
      errors.push(
        `- ${target.name} (${target.packageJsonPath}): missing package.json "repository.url"; expected repo "${expectedRepo}".`
      );
      continue;
    }

    let normalizedRepository: string;
    try {
      normalizedRepository = normalizeRepositoryReference(target.repositoryUrl);
    } catch (error) {
      errors.push(
        `- ${target.name} (${target.packageJsonPath}): invalid package.json "repository.url" "${target.repositoryUrl}". ${(error as Error).message}`
      );
      continue;
    }

    if (normalizedRepository !== expectedRepo) {
      errors.push(
        `- ${target.name} (${target.packageJsonPath}): package.json "repository.url" is "${target.repositoryUrl}" (normalized: "${normalizedRepository}"), expected repo "${expectedRepo}".`
      );
    }
  }

  if (errors.length > 0) {
    throw new Error(
      'Repository validation failed before granting trusted publishing relationships:\n' +
        errors.join('\n')
    );
  }
}

interface TrustPermissions {
  allowPublish: boolean;
  allowStagePublish: boolean;
}

function resolveTrustPermissions(options: TrustOptions): TrustPermissions {
  const allowPublish = options.allowPublish === true;
  const allowStagePublish = options.allowStagePublish === true;

  if (!allowPublish && !allowStagePublish) {
    return {
      allowPublish: true,
      allowStagePublish
    };
  }

  return {
    allowPublish,
    allowStagePublish
  };
}

function appendTrustPermissionArgs(args: string[], permissions: TrustPermissions): void {
  if (permissions.allowPublish) {
    args.push('--allow-publish');
  }

  if (permissions.allowStagePublish) {
    args.push('--allow-stage-publish');
  }
}

function formatAllowedActions(permissions: Partial<TrustPermissions>): string {
  const actions: string[] = [];

  if (permissions.allowPublish) {
    actions.push(lightGreen('publish'));
  }

  if (permissions.allowStagePublish) {
    actions.push(lightGreen('stage publish'));
  }

  if (actions.length > 0) {
    return actions.join(', ');
  }

  if (permissions.allowPublish === undefined && permissions.allowStagePublish === undefined) {
    return dim('unknown');
  }

  return lightGreen('publish');
}

function formatLogField(label: string, value: string, width: number): string {
  return `${dim(label)}${' '.repeat(Math.max(1, width - label.length))}${value}`;
}

function readBooleanField(record: Record<string, unknown>, keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'boolean') {
      return value;
    }
  }

  return undefined;
}

function getListPermissions(json: ListResult): Partial<TrustPermissions> {
  const record = json as unknown as Record<string, unknown>;
  const permissions = record.permissions;
  let allowPublish = readBooleanField(record, ['allowPublish', 'allow_publish']);
  let allowStagePublish = readBooleanField(record, [
    'allowStagePublish',
    'allow_stage_publish',
    'allowStage'
  ]);

  if (Array.isArray(permissions)) {
    const permissionNames = new Set(permissions.filter((item) => typeof item === 'string'));

    allowPublish ??= permissionNames.has('publish');
    allowStagePublish ??=
      permissionNames.has('stage-publish') ||
      permissionNames.has('stage_publish') ||
      permissionNames.has('stagePublish');
  } else if (permissions && typeof permissions === 'object') {
    const permissionRecord = permissions as Record<string, unknown>;
    allowPublish ??= readBooleanField(permissionRecord, ['publish', 'allowPublish']);
    allowStagePublish ??= readBooleanField(permissionRecord, [
      'stagePublish',
      'stage-publish',
      'stage_publish',
      'allowStagePublish'
    ]);
  }

  return {
    allowPublish,
    allowStagePublish
  };
}

function permissionsMatch(
  existingPermissions: Partial<TrustPermissions>,
  targetPermissions: TrustPermissions
): boolean {
  if (
    existingPermissions.allowPublish === undefined &&
    existingPermissions.allowStagePublish === undefined
  ) {
    return true;
  }

  return (
    (existingPermissions.allowPublish === undefined ||
      existingPermissions.allowPublish === targetPermissions.allowPublish) &&
    (existingPermissions.allowStagePublish === undefined ||
      existingPermissions.allowStagePublish === targetPermissions.allowStagePublish)
  );
}

/**
 * 1. Check npm version >= 11.13.0
 * 2. Infer repo info
 * 3. Print all the inferred info, and waiting for confirm
 * 4. Run npm trust
 *
 * @param packages package names to be managed
 * @param options
 */
export async function trust(packages: string[], options: TrustOptions) {
  const npmVersion = await checkNpmVersion({ cwd: options.dir, mise: options.mise });
  const repoInfo = await inferRepoInfo(options);
  const targets = getPackageTargets(packages, options);
  const permissions = resolveTrustPermissions(options);

  validateRepositoryAlignment(targets, repoInfo.repo);

  console.log(formatLogField('npm', `${npmVersion} ${options.mise ? dim('(mise)') : ''}`, 12));
  console.log(formatLogField('provider', repoInfo.provider, 12));
  console.log(formatLogField('repository', repoInfo.repo, 12));
  console.log(formatLogField('workflow', repoInfo.file, 12));
  if (options.env) {
    console.log(formatLogField('environment', options.env, 12));
  }
  console.log(formatLogField('actions', formatAllowedActions(permissions), 12));
  console.log(formatLogField('packages', packages.map((name) => lightGreen(name)).join(', '), 12));
  console.log();

  await confirm('Proceed to grant trusted publishing relationships?', {
    yes: options.yes,
    dryRun: options.dryRun
  });

  const results: CommandExecutionResult[] = [];
  for (const packageName of packages) {
    // Check existed relation
    const relation = await list(packageName, options);

    if (relation.json) {
      const { repository, file } = relation.json;
      const existingPermissions = getListPermissions(relation.json);
      if (
        repoInfo.repo === repository &&
        repoInfo.file === file &&
        permissionsMatch(existingPermissions, permissions)
      ) {
        // Skip binding relation
        continue;
      } else {
        // Revoke relation
        await revoke(relation.package, relation.json.id, options);
      }
    }

    // Do trust
    const args = [
      'trust',
      repoInfo.provider,
      packageName,
      '--repo',
      repoInfo.repo,
      '--file',
      repoInfo.file,
      '--yes'
    ];

    if (options.env) {
      args.push('--env', options.env);
    }

    appendTrustPermissionArgs(args, permissions);

    if (options.registry) {
      args.push('--registry', options.registry);
    }

    const command = getNpmCommand(args, options.mise);
    console.log();
    console.log(`$ ${command.join(' ')}`);

    if (options.dryRun) {
      results.push({
        package: packageName,
        command,
        status: 'dry-run'
      });
    } else {
      const result = await runNpm({
        args,
        cwd: options.dir,
        mise: options.mise,
        stdio: 'inherit'
      });
      results.push({
        package: packageName,
        command,
        status: 'success',
        stdout: result.stdout
      });
    }
  }

  return results;
}

/**
 * 1. Check npm version >= 11.13.0
 * 2. Run npm trust list
 * 3. Print trust list
 *
 * @param packages package names to be managed
 * @param options
 */
export async function listRelationships(packages: string[], options: TrustOptions) {
  const npmVersion = await checkNpmVersion({ cwd: options.dir, mise: options.mise });

  console.log(formatLogField('npm', `${npmVersion} ${options.mise ? dim('(mise)') : ''}`, 12));
  console.log(formatLogField('packages', packages.map((name) => lightGreen(name)).join(', '), 12));

  const results: CommandExecutionResult<ListResult>[] = [];
  for (const packageName of packages) {
    const result = await list(packageName, options);
    results.push(result);
  }

  return results;
}

async function list(
  packageName: string,
  options: TrustOptions
): Promise<CommandExecutionResult<ListResult>> {
  const args = ['trust', 'list', '--json', packageName];

  if (options.registry) {
    args.push('--registry', options.registry);
  }

  const command = getNpmCommand(args, options.mise);

  console.log();
  console.log(`$ ${command.join(' ')}`);

  if (options.dryRun) {
    return {
      package: packageName,
      command,
      status: 'dry-run'
    };
  } else {
    let ret: CommandExecutionResult;
    try {
      const result = await runNpm({
        args,
        cwd: options.dir,
        mise: options.mise
      });

      ret = {
        package: packageName,
        command,
        status: 'success',
        stdout: result.stdout
      };
    } catch (error) {
      await runNpm({
        args,
        cwd: options.dir,
        mise: options.mise,
        stdio: 'inherit'
      });

      const result = await runNpm({
        args,
        cwd: options.dir,
        mise: options.mise
      });

      ret = {
        package: packageName,
        command,
        status: 'success',
        stdout: result.stdout
      };
    }

    if (ret.stdout) {
      ret.json = JSON.parse(ret.stdout);

      console.log(formatLogField('id', lightGreen(ret.json.id), 8));
      console.log(formatLogField('type', lightGreen(ret.json.type), 8));
      console.log(formatLogField('repo', lightGreen(ret.json.repository), 8));
      console.log(formatLogField('file', lightGreen(ret.json.file), 8));
      const permissions = getListPermissions(ret.json);
      console.log(formatLogField('actions', formatAllowedActions(permissions), 8));
    }

    return ret;
  }
}

/**
 * 1. Check npm version >= 11.13.0
 * 2. Run npm trust list
 * 3. Print trust list and waiting for confirm
 * 4. Run npm trust revoke
 *
 * @param packages package names to be managed
 * @param options
 */
export async function revokeRelationships(packages: string[], options: TrustOptions) {
  const npmVersion = await checkNpmVersion({ cwd: options.dir, mise: options.mise });

  console.log(formatLogField('npm', `${npmVersion} ${options.mise ? dim('(mise)') : ''}`, 12));
  console.log(formatLogField('packages', packages.map((name) => lightGreen(name)).join(', '), 12));

  const relations: CommandExecutionResult<ListResult>[] = [];
  for (const packageName of packages) {
    const result = await list(packageName, options);

    if (result.json) {
      relations.push(result);
    }
  }

  if (relations.length === 0) return [];

  await confirm(
    `Proceed to revoke above ${relations.length} trusted relationship(s) across ${packages.length} package(s)?`,
    {
      yes: options.yes,
      dryRun: options.dryRun
    }
  );

  const results: CommandExecutionResult[] = [];

  for (const relation of relations) {
    const result = await revoke(relation.package, relation.json!.id, options);
    results.push(result);
  }

  return results;
}

async function revoke(
  packageName: string,
  id: string,
  options: TrustOptions
): Promise<CommandExecutionResult> {
  const revokeArgs = ['trust', 'revoke', '--id', id, packageName];
  if (options.registry) {
    revokeArgs.push('--registry', options.registry);
  }

  const command = getNpmCommand(revokeArgs, options.mise);
  console.log(`$ ${command.join(' ')}`);

  if (options.dryRun) {
    return {
      package: packageName,
      command,
      status: 'dry-run'
    };
  } else {
    const result = await runNpm({
      args: revokeArgs,
      cwd: options.dir,
      mise: options.mise,
      stdio: 'inherit'
    });

    return {
      package: packageName,
      command,
      status: 'success',
      stdout: result.stdout
    };
  }
}
