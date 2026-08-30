import { toNextJsHandler } from 'better-auth/next-js';
import { auth } from '@/lib/auth';
import { requireRuntimeEnv } from '@/lib/env';

const handler = toNextJsHandler(auth);

function configurationError() {
  return Response.json(
    { error: 'Autenticação indisponível até concluir a configuração segura do ambiente.' },
    { status: 503 },
  );
}

function ensureRuntimeConfiguration() {
  try {
    requireRuntimeEnv();
    return null;
  } catch (error) {
    console.error('A autenticação não pôde iniciar porque a configuração do ambiente é inválida.', error);
    return configurationError();
  }
}

export async function GET(request: Request) {
  const error = ensureRuntimeConfiguration();
  if (error) return error;
  return handler.GET(request);
}

export async function POST(request: Request) {
  const error = ensureRuntimeConfiguration();
  if (error) return error;
  return handler.POST(request);
}
