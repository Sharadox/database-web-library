/**
 * The GitHub Actions job's identity token for AWS (audience `sts.amazonaws.com`), to take an IAM role without any
 * stored key. The job needs `permissions: { id-token: write }`.
 *
 * @example
 * const credentials = fromWebToken({ roleArn, webIdentityToken: await gitHubWebIdentityToken() });
 */
export async function gitHubWebIdentityToken(
  environment: Record<string, string | undefined> = process.env,
): Promise<string> {
  const url = environment.ACTIONS_ID_TOKEN_REQUEST_URL;
  const token = environment.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if (!url || !token) throw new Error("no GitHub Actions identity: the job needs permissions id-token: write");
  const response = await fetch(`${url}&audience=sts.amazonaws.com`, { headers: { authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`GitHub refused the identity token (${response.status})`);
  return ((await response.json()) as { value: string }).value;
}
