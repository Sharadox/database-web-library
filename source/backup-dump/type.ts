/** Runs a program with arguments and extra environment variables; resolves with what it printed. */
export type ProgramRunner = (
  program: string,
  parameters: string[],
  environment: Record<string, string | undefined>,
) => Promise<Uint8Array>;

export interface DumpOptions {
  /** `pg_dump` by default (its major version must be the server's or later). */
  program?: string;
  /** How to run it (tests give their own). */
  run?: ProgramRunner;
}
