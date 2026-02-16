import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

export async function confirm(
  prompt: string,
  options: { dryRun?: boolean; yes?: boolean }
): Promise<void> {
  if (options.yes || options.dryRun) {
    return;
  }

  if (!input.isTTY) {
    throw new Error(
      'This command requires confirmation. Re-run with --yes in non-interactive mode.'
    );
  }

  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question(`${prompt} [Y/n]: `);
    if (!/^$|^y(es)?$/i.test(answer.trim())) {
      throw new Error('Operation cancelled by user.');
    }
  } finally {
    rl.close();
  }
}
