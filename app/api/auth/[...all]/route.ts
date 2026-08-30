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

export async function GET(request: Request) {
  try {
    requireRuntimeEnv();
    return handler.GET(request);
  } catch {
    return configurationError();
  }
}

export async function POST(request: Request) {
  try {
    requireRuntimeEnv();
    return handler.POST(request);
  } catch {
    return configurationError();
  }
}
