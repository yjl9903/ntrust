import { dim, lightGreen } from 'breadc';

import type { TrustOptions } from './types.ts';

import { confirm } from './tui.ts';
import { inferRepoInfo } from './git.ts';
import { checkNpmVersion, getNpmCommand, runNpm } from './npm.ts';

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
}

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
  const npmVersion = await checkNpmVersion({ cwd: options.dir, mise: options.mise });
  const repoInfo = await inferRepoInfo(options);

  console.log(`${dim('npm')}         ${npmVersion} ${options.mise ? dim('(mise)') : ''}`);
  console.log(`${dim('provider')}    ${repoInfo.provider}`);
  console.log(`${dim('repository')}  ${repoInfo.repo}`);
  console.log(`${dim('workflow')}    ${repoInfo.file}`);
  if (options.env) {
    console.log(`${dim('environment')} ${options.env}`);
  }
  console.log(`${dim('packages')}    ${packages.map((name) => lightGreen(name)).join(', ')}`);
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
      if (repoInfo.repo === repository && repoInfo.file === file) {
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
 * 1. Check npm version >= 11.10.0
 * 2. Run npm trust list
 * 3. Print trust list
 *
 * @param packages package names to be managed
 * @param options
 */
export async function listRelationships(packages: string[], options: TrustOptions) {
  const npmVersion = await checkNpmVersion({ cwd: options.dir, mise: options.mise });

  console.log(`${dim('npm')}         ${npmVersion} ${options.mise ? dim('(mise)') : ''}`);
  console.log(`${dim('packages')}    ${packages.map((name) => lightGreen(name)).join(', ')}`);

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

      console.log(`${dim('id')}    ${lightGreen(ret.json.id)}`);
      console.log(`${dim('type')}  ${lightGreen(ret.json.type)}`);
      console.log(`${dim('repo')}  ${lightGreen(ret.json.repository)}`);
      console.log(`${dim('file')}  ${lightGreen(ret.json.file)}`);
    }

    return ret;
  }
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
  const npmVersion = await checkNpmVersion({ cwd: options.dir, mise: options.mise });

  console.log(`${dim('npm')}         ${npmVersion} ${options.mise ? dim('(mise)') : ''}`);
  console.log(`${dim('packages')}    ${packages.map((name) => lightGreen(name)).join(', ')}`);

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
