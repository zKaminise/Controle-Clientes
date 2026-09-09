import { listAgentIntegrations } from '@/lib/agent-admin';

const integrations = await listAgentIntegrations();
console.log(JSON.stringify({ integrations }, null, 2));
