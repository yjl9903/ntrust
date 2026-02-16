import type { Dirent } from 'node:fs';

import path from 'node:path';
import { readdir, readFile } from 'node:fs/promises';

import yaml from 'js-yaml';

interface PublishCommandMatch {
  file: string;
  job: string;
  step: number;
  command: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function splitRunCommand(run: string): string[] {
  return run
    .split(/\r?\n|&&|\|\||;/g)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function isDirectPublishCommand(command: string): boolean {
  const tokens = command.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) {
    return false;
  }

  const packageManager = tokens[0];
  if (!['npm', 'pnpm', 'yarn'].includes(packageManager)) {
    return false;
  }

  let subCommand = '';
  for (const token of tokens.slice(1)) {
    if (token.startsWith('-')) {
      continue;
    }
    subCommand = token;
    break;
  }

  return subCommand === 'publish';
}

function formatPublishCandidates(matches: PublishCommandMatch[]): string {
  return matches
    .map((match) => `- ${match.file} (job=${match.job}, step=${match.step}): ${match.command}`)
    .join('\n');
}

async function collectPublishCommandMatches(repoRoot: string): Promise<PublishCommandMatch[]> {
  const workflowDir = path.join(repoRoot, '.github', 'workflows');
  let entries: Dirent[];
  try {
    entries = await readdir(workflowDir, { withFileTypes: true });
  } catch {
    throw new Error(
      `Cannot find workflow directory "${workflowDir}". Please specify --file manually.`
    );
  }
  const workflowFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.yml'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  const matches: PublishCommandMatch[] = [];

  for (const workflowFile of workflowFiles) {
    const workflowPath = path.join(workflowDir, workflowFile);
    const content = await readFile(workflowPath, 'utf8');
    const workflow = yaml.load(content);

    if (!isRecord(workflow) || !isRecord(workflow.jobs)) {
      continue;
    }

    for (const [jobName, jobValue] of Object.entries(workflow.jobs)) {
      if (!isRecord(jobValue) || !Array.isArray(jobValue.steps)) {
        continue;
      }

      for (const [index, step] of jobValue.steps.entries()) {
        if (!isRecord(step) || typeof step.run !== 'string') {
          continue;
        }

        const commands = splitRunCommand(step.run);
        for (const command of commands) {
          if (isDirectPublishCommand(command)) {
            matches.push({
              file: workflowFile,
              job: jobName,
              step: index + 1,
              command
            });
          }
        }
      }
    }
  }

  return matches;
}

export async function inferGithubWorkflowFile(repoRoot: string): Promise<string | undefined> {
  const matches = await collectPublishCommandMatches(repoRoot);

  if (matches.length > 1) {
    throw new Error(
      'Found multiple publish workflow commands in GitHub actions. Please specify --file manually.\n' +
        formatPublishCandidates(matches)
    );
  }

  if (matches.length === 0) {
    return undefined;
  }

  return matches[0].file;
}
