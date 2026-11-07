import { queryOptions } from '@tanstack/react-query';
import { getAccess, getMembers } from './foundation.functions';
import { retryTransientNetwork } from './query-retry';
// Loaded by the protected layout for every signed-in page: one dropped connection must not fail the whole page.
export const accessOptions = queryOptions({ queryKey: ['access'], queryFn: () => getAccess(), staleTime: 30_000, retry: retryTransientNetwork, retryDelay: attempt => 400 * 2 ** attempt });
export const memberOptions = (workspace_id: string) => queryOptions({ queryKey: ['members', workspace_id], queryFn: () => getMembers({ data: { workspace_id } }) });
import { getKnowledge } from './knowledge.functions';
export const knowledgeOptions = (workspace_id: string) => queryOptions({ queryKey: ['knowledge', workspace_id], queryFn: () => getKnowledge({ data: { workspace_id } }) });
export type Knowledge = Awaited<ReturnType<typeof getKnowledge>>;
