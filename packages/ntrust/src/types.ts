export interface TrustOptions {
  /**
   * Trust publish provider
   */
  provider?: 'github' | 'gitlab';

  /**
   * Filter packages
   */
  packages?: string[];

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
   * Use mise to run npm command
   */
  mise?: boolean;

  /**
   * @default false
   */
  dryRun?: boolean;

  /**
   * Keep quiet and only output JSON
   */
  json?: boolean;
}
