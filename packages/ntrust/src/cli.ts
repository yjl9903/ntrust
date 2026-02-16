import { breadc } from 'breadc';

import { version, description } from '../package.json';

import { trust } from './trust.ts';

const app = breadc('ntrust', { version, description })
  .option('--file <name>', 'Name of trust pipeline file')
  .option('--repo <name>', 'Name of trust repository')
  .option('--env <name>', 'CI environment name')
  .option('--mise', 'Use mise to run npm command')
  .option('--dry-run', 'Show what would done')
  .option('--json', 'Only output JSON data')
  .option('--registry <url>', 'The base URL of the npm registry')
  .option('-y, --yes', 'Automatically answer "yes" to any prompts');

app
  .command(
    '[...packages]',
    'Batch-create trusted relationships between packages and GitHub actions or GitLab CI/CD'
  )
  .action(async (packages, options) => {
    return await trust({
      packages,
      ...options
    });
  });

app
  .command(
    'github [...packages]',
    'Batch-create trusted relationships between packages and GitHub actions'
  )
  .action(async (packages, options) => {
    return await trust({
      packages,
      ...options,
      provider: 'github'
    });
  });

app
  .command(
    'gitlab [...packages]',
    'Batch-create trusted relationships between packages and GitLab CI/CD'
  )
  .action(async (packages, options) => {
    return await trust({
      packages,
      ...options,
      provider: 'gitlab'
    });
  });

app.command('list [...packages]', 'Batch-list trusted relationships').action(async () => {
  // TODO
});

app.command('revoke [...packages]', 'Batch-revoke trusted relationships').action(async () => {
  // TODO
});

await app.run(process.argv.slice(2)).catch((error) => {
  console.error(error);
});
