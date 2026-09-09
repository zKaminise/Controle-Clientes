import { MCP_READ_SCOPES, MCP_WRITE_SCOPES, mcpResourceUrl } from '@/lib/mcp-config';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json(
    {
      resource: mcpResourceUrl(),
      resource_name: 'Controle de Clientes CRM',
      authorization_servers: [new URL('/api/auth', env.BETTER_AUTH_URL).toString()],
      bearer_methods_supported: ['header'],
      scopes_supported: [...MCP_READ_SCOPES, ...MCP_WRITE_SCOPES],
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=300',
      },
    },
  );
}
