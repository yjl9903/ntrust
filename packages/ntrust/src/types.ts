export interface TrustOptions {
  /**
   * Trust publish provider
   */
  provider?: 'github' | 'gitlab';

  /**
   * Specify GitHub actions workflow file or GitLab CI/CD file
   */
  file?: string;

  /**
   * Specify GitHub or GitLab repo
   */
  repo?: string;

  /**
   * Specify registry
   */
  registry?: string;

  /**
   * CI environment name for trusted publisher claim
   */
  env?: string;

  /**
   * Use mise to run npm command
   */
  mise?: boolean;

  /**
   * Specify cwd
   */
  dir?: string;

  /**
   * @default false
   */
  dryRun?: boolean;

  /**
   * @default false
   */
  yes?: boolean;
}
