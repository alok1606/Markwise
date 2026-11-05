import { queryOptions } from '@tanstack/react-query';
import { getContent, listMyContent, listWorkspaceContent } from './content.functions';
export const myContentOptions = (workspace_id: string) => queryOptions({ queryKey: ['content', 'mine', workspace_id], queryFn: () => listMyContent({ data: { workspace_id } }) });
export const workspaceContentOptions = (workspace_id: string) => queryOptions({ queryKey: ['content', 'all', workspace_id], queryFn: () => listWorkspaceContent({ data: { workspace_id } }) });
export const contentOptions = (workspace_id: string, id: string) => queryOptions({ queryKey: ['content', 'item', workspace_id, id], queryFn: () => getContent({ data: { workspace_id, id } }) });
