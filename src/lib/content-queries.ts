import { queryOptions } from '@tanstack/react-query';
import { getContent, listMyContent, listWorkspaceContent } from './content.functions';
import { listReviewQueue, listWorkspaceReviewers } from './approval.functions';
export const myContentOptions = (workspace_id: string) => queryOptions({ queryKey: ['content', 'mine', workspace_id], queryFn: () => listMyContent({ data: { workspace_id } }) });
export const workspaceContentOptions = (workspace_id: string) => queryOptions({ queryKey: ['content', 'all', workspace_id], queryFn: () => listWorkspaceContent({ data: { workspace_id } }) });
export const contentOptions = (workspace_id: string, id: string) => queryOptions({ queryKey: ['content', 'item', workspace_id, id], queryFn: () => getContent({ data: { workspace_id, id } }) });
export const reviewersOptions = (workspace_id: string) => queryOptions({ queryKey: ['content', 'reviewers', workspace_id], queryFn: () => listWorkspaceReviewers({ data: { workspace_id } }) });
export const reviewQueueOptions = (workspace_id: string) => queryOptions({ queryKey: ['content', 'queue', workspace_id], queryFn: () => listReviewQueue({ data: { workspace_id } }) });
