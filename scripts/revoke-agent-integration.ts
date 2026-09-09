import { revokeAgentCredential } from '@/lib/agent-admin';

function argument(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1]?.trim() : undefined;
}

const clientId = argument('client-id');
const tokenId = argument('token-id');
const result = await revokeAgentCredential({ clientId, tokenId });

console.log(
  JSON.stringify(
    {
      clientId: result.clientId,
      tokenId: result.tokenId,
      revokedAt: result.revokedAt.toISOString(),
    },
    null,
    2,
  ),
);
