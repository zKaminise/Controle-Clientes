import { spawn } from 'node:child_process';
import { once } from 'node:events';
import {
  createAgentIntegration,
  revokeAgentCredential,
} from '@/lib/agent-admin';
import {
  AGENT_SCOPES,
  AGENT_READ_SCOPES,
  expectedAgentAudience,
  type AgentScope,
} from '@/lib/agent-auth';

function argument(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function flag(name: string) {
  return process.argv.includes(`--${name}`);
}

async function copyToClipboard(secret: string) {
  if (process.platform !== 'win32')
    throw new Error(
      '--copy-to-clipboard está disponível somente no Windows. Use --show-token em um terminal interativo.',
    );
  const clipboard = spawn('clip.exe', [], {
    stdio: ['pipe', 'ignore', 'ignore'],
    windowsHide: true,
  });
  clipboard.stdin.end(secret);
  const [exitCode] = (await once(clipboard, 'exit')) as [number | null];
  if (exitCode !== 0)
    throw new Error('Não foi possível copiar para o clipboard.');
}

const showToken = flag('show-token');
const copyToken = flag('copy-to-clipboard');
if (showToken === copyToken)
  throw new Error(
    'Escolha exatamente uma entrega segura: --copy-to-clipboard ou --show-token.',
  );
if (showToken && !process.stdout.isTTY)
  throw new Error('--show-token exige um terminal interativo (TTY).');

const name = argument('name')?.trim() || 'codex-readonly';
const expiresInDays = Number(argument('expires-in-days') || 60);
const rateLimitPerMinute = Number(argument('rate-limit') || 60);
const audience = argument('audience')?.trim() || expectedAgentAudience();
// New opaque credentials remain read-only unless write scopes are explicitly requested.
const requestedScopes = (argument('scopes') || AGENT_READ_SCOPES.join(','))
  .split(',')
  .map((scope) => scope.trim())
  .filter(Boolean) as AgentScope[];

if (
  !Number.isInteger(expiresInDays) ||
  expiresInDays < 1 ||
  expiresInDays > 365
)
  throw new Error('--expires-in-days deve estar entre 1 e 365.');
if (
  !Number.isInteger(rateLimitPerMinute) ||
  rateLimitPerMinute < 1 ||
  rateLimitPerMinute > 600
)
  throw new Error('--rate-limit deve estar entre 1 e 600.');
const invalidScopes = requestedScopes.filter(
  (scope) => !AGENT_SCOPES.includes(scope),
);
if (invalidScopes.length)
  throw new Error(`Scopes inválidos: ${invalidScopes.join(', ')}`);

const result = await createAgentIntegration({
  name,
  audience,
  scopes: requestedScopes,
  expiresAt: new Date(Date.now() + expiresInDays * 86_400_000),
  rateLimitPerMinute,
});

if (copyToken) {
  try {
    await copyToClipboard(result.token);
  } catch (error) {
    await revokeAgentCredential({ clientId: result.clientId });
    throw new Error(
      'A entrega pelo clipboard falhou; a credencial recém-criada foi revogada.',
      { cause: error },
    );
  }
}

console.log(
  JSON.stringify(
    {
      clientId: result.clientId,
      tokenId: result.tokenId,
      token: showToken
        ? result.token
        : 'copiado para o clipboard; não recuperável',
      fingerprint: result.tokenPrefix,
      ownerEmail: result.ownerEmail,
      name: result.name,
      audience: result.audience,
      scopes: result.scopes,
      expiresAt: result.expiresAt.toISOString(),
      rateLimitPerMinute: result.rateLimitPerMinute,
      warning:
        'Guarde o segredo agora. O banco armazena somente o hash e não permite recuperá-lo.',
    },
    null,
    2,
  ),
);
