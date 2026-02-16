import { breadc } from 'breadc';

import { version, description } from '../package.json';

import { findPackages } from './monorepo.ts';
import { trust, listRelationships, revokeRelationships } from './trust.ts';

const app = breadc('ntrust', { version, description })
  .option('--file <name>', 'Name of trust pipeline file')
  .option('--repo <name>', 'Name of trust repository')
  .option('--env <name>', 'CI environment name for npm trust claim')
  .option('--registry <url>', 'The base URL of the npm registry')
  .option('--mise', 'Use mise to run npm command')
  .option('--dry-run', 'Show what would be done')
  .option('-y, --yes', 'Automatically answer "yes" to any prompts')
  .option('-C, --dir <dir>', 'Specify dir to run command')
  .use(async (ctx, next) => {
    if (process.execPath.includes('/mise/')) {
      // Auto infer mise options
      const matched = ctx.options.get('mise');
      if (matched && !matched.dirty) {
        matched.accept(ctx, 'mise', undefined);
      }
    }
    return next();
  });

app
  .command(
    '[...files]',
    'Batch-create trusted relationships between npm packages and CI/CD providers'
  )
  .action(async (files, options) => {
    const { packages } = await findPackages(options.dir, files ?? []);

    return await trust(packages, {
      ...options
    });
  });

app
  .command(
    'github [...files]',
    'Batch-create trusted relationships between packages and GitHub actions'
  )
  .action(async (files, options) => {
    const { packages } = await findPackages(options.dir, files ?? []);

    return await trust(packages, {
      ...options,
      provider: 'github'
    });
  });

app
  .command(
    'gitlab [...files]',
    'Batch-create trusted relationships between packages and GitLab CI/CD'
  )
  .action(async (files, options) => {
    const { packages } = await findPackages(options.dir, files ?? []);

    return await trust(packages, {
      ...options,
      provider: 'gitlab'
    });
  });

app
  .command('list [...files]', 'Batch-list trusted relationships')
  .action(async (files, options) => {
    const { packages } = await findPackages(options.dir, files ?? []);
    return await listRelationships(packages, { ...options });
  });

app
  .command('revoke [...files]', 'Batch-revoke trusted relationships')
  .action(async (files, options) => {
    const { packages } = await findPackages(options.dir, files ?? []);
    return await revokeRelationships(packages, { ...options });
  });

await app.run(process.argv.slice(2)).catch((error) => {
  console.error(error);
});
