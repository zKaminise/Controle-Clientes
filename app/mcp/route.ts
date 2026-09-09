import { createMcpHandler, type AuthInfo } from '@modelcontextprotocol/server';
import { requireMcpAuth } from '@better-auth/mcp';
import { auth } from '@/lib/auth';
import { MCP_READ_SCOPES, mcpResourceUrl } from '@/lib/mcp-config';
import { createCrmMcpServer } from '@/lib/mcp-server';
import { authorizeMcpRequest, type McpPrincipal } from '@/lib/mcp-security';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const handler = createMcpHandler(
  ({ authInfo }) => {
    const principal = authInfo?.extra?.principal as McpPrincipal | undefined;
    if (!principal) throw new Error('Contexto MCP autenticado ausente.');
    return createCrmMcpServer(principal);
  },
  { legacy: 'reject', responseMode: 'json' },
);

const protectedHandler = requireMcpAuth(
  auth,
  async (request, claims) => {
    const principal = await authorizeMcpRequest(request, claims);
    const authInfo: AuthInfo = {
      ...principal.authInfo,
      extra: { ...principal.authInfo.extra, principal },
    };
    return handler.fetch(request, { authInfo });
  },
  {
    resource: mcpResourceUrl(),
    challengeScopes: [...MCP_READ_SCOPES],
  },
);

export async function POST(request: Request) {
  return protectedHandler(request);
}

