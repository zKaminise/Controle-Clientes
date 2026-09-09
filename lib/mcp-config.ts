import { env } from '@/lib/env';

export const MCP_READ_SCOPES = [
  'crm:leads:read',
  'crm:pipeline:read',
  'crm:followups:read',
  'crm:analysis:read',
  'crm:metrics:read',
] as const;

export const MCP_WRITE_SCOPES = [
  'crm:leads:write',
  'crm:pipeline:write',
  'crm:interactions:write',
  'crm:followups:write',
  'crm:referrals:write',
  'crm:analysis:write',
] as const;

export const MCP_OIDC_SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
] as const;

export const MCP_SCOPES = [
  ...MCP_OIDC_SCOPES,
  ...MCP_READ_SCOPES,
  ...MCP_WRITE_SCOPES,
] as const;

export type McpReadScope = (typeof MCP_READ_SCOPES)[number];
export type McpWriteScope = (typeof MCP_WRITE_SCOPES)[number];
export type McpCrmScope = McpReadScope | McpWriteScope;

export function mcpResourceUrl() {
  return new URL('/mcp', env.NEXT_PUBLIC_APP_URL).toString();
}

export function mcpAllowedAdminEmail() {
  return (
    env.AGENT_ALLOWED_ADMIN_EMAIL ||
    env.ADMIN_EMAIL ||
    'gabriel.misao08@gmail.com'
  ).toLowerCase();
}

