import { createMcpHandler, type AuthInfo } from '@modelcontextprotocol/server';
import { requireMcpAuth } from '@better-auth/mcp';
import { auth } from '@/lib/auth';
import { MCP_READ_SCOPES, MCP_WRITE_SCOPES, mcpResourceUrl } from '@/lib/mcp-config';
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
  // Keep the current 2026 transport while serving the 2025 stateless
  // handshake used by released Codex clients during the transition.
  { legacy: 'stateless', responseMode: 'json' },
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
    challengeScopes: [...MCP_READ_SCOPES, ...MCP_WRITE_SCOPES],
  },
);

export async function POST(request: Request) {
  return protectedHandler(request);
}
