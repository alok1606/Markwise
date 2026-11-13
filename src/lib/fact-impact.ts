export type FactSnapshot = {
  id: string; workspace_id: string; code: string; title: string; statement: string;
  active: boolean; status: string; version: number; created_at: string;
};
export type FactHistorySnapshot = {
  fact_id: string; workspace_id: string; version: number; change: 'updated' | 'deleted';
  snapshot: Record<string, unknown>; changed_at: string;
};
export type FactChange = {
  id: string; fact_id: string; workspace_id: string; code: string; title: string;
  kind: 'created' | 'changed' | 'retired'; changed_at: string; old_value: string | null;
  new_value: string | null; old_snapshot: FactSnapshot | null;
  new_snapshot: FactSnapshot | null;
};
export type ContentVersionForImpact = {
  id: string; content_id: string; workspace_id: string; version_number: number;
  title: string; body_text: string; alt_text?: string | null; created_at: string;
};
export type FactCitation = { workspace_id: string; content_id: string; content_version_id: string; fact_id: string; cited_code: string; cited_passage: string };
export type FactImpact = {
  change_id: string; fact_id: string; fact_code: string; fact_title: string;
  content_id: string; content_version_id: string; version_number: number; title: string;
  confidence: 'confirmed' | 'possible'; reason: string; matched_text: string;
};

function asSnapshot(row: FactHistorySnapshot) {
  return row.snapshot as unknown as FactSnapshot;
}
function text(value: unknown) { return typeof value === 'string' ? value : ''; }

/** Reconstructs changes solely from the existing immutable fact_history snapshots and current row. */
export function buildFactChanges(workspaceId: string, facts: FactSnapshot[], history: FactHistorySnapshot[]): FactChange[] {
  const scopedHistory = history.filter(row => row.workspace_id === workspaceId);
  const scopedFacts = facts.filter(row => row.workspace_id === workspaceId);
  const byFact = new Map<string, FactHistorySnapshot[]>();
  for (const row of scopedHistory) byFact.set(row.fact_id, [...(byFact.get(row.fact_id) ?? []), row]);
  const changes: FactChange[] = [];
  const ids = new Set([...scopedFacts.map(row => row.id), ...scopedHistory.map(row => row.fact_id)]);
  for (const factId of ids) {
    const current = scopedFacts.find(row => row.id === factId);
    const versions = (byFact.get(factId) ?? []).slice().sort((a, b) => a.version - b.version || a.changed_at.localeCompare(b.changed_at));
    const snapshots = new Map<number, FactSnapshot>();
    for (const row of versions) snapshots.set(row.version, asSnapshot(row));
    if (current) snapshots.set(current.version, current);
    const creationSnapshot = snapshots.get(1) ?? (current?.version === 1 ? current : null);
    if (creationSnapshot) changes.push({
      id: `${factId}:created`, fact_id: factId, workspace_id: workspaceId, code: text(creationSnapshot.code), title: text(creationSnapshot.title),
      kind: 'created', changed_at: text(creationSnapshot.created_at), old_value: null, new_value: text(creationSnapshot.statement), old_snapshot: null,
      new_snapshot: creationSnapshot,
    });
    for (const row of versions) {
      const old = asSnapshot(row);
      if (row.change === 'deleted') {
        changes.push({ id: `${factId}:deleted:${row.version}:${row.changed_at}`, fact_id: factId, workspace_id: workspaceId, code: text(old.code), title: text(old.title), kind: 'retired', changed_at: row.changed_at,
          old_value: text(old.statement), new_value: null, old_snapshot: old, new_snapshot: null });
        continue;
      }
      const next = snapshots.get(row.version + 1);
      if (!next) continue;
      const retired = old.active !== false && next.active === false;
      changes.push({ id: `${factId}:v${row.version}-v${row.version + 1}`, fact_id: factId, workspace_id: workspaceId, code: text(next.code || old.code), title: text(next.title || old.title),
        kind: retired ? 'retired' : 'changed', changed_at: row.changed_at, old_value: text(old.statement), new_value: text(next.statement),
        old_snapshot: old, new_snapshot: next });
    }
  }
  return changes.sort((a, b) => b.changed_at.localeCompare(a.changed_at));
}

function normalized(value: string) { return value.toLocaleLowerCase().replace(/\s+/g, ' ').trim(); }
function snippets(change: FactChange) {
  return [change.old_value, change.new_value].filter((value): value is string => !!value && normalized(value).length >= 24);
}

/** Explicit citations are confirmed. Text-only matches are intentionally labelled possible, never treated as verified dependency. */
export function findFactImpacts(
  workspaceId: string, changes: FactChange[], versions: ContentVersionForImpact[], citations: FactCitation[],
): FactImpact[] {
  const result = new Map<string, FactImpact>();
  const scopedChanges = changes.filter(row => row.workspace_id === workspaceId);
  const scopedVersions = versions.filter(row => row.workspace_id === workspaceId);
  const scopedCitations = citations.filter(row => row.workspace_id === workspaceId);
  for (const change of scopedChanges) {
    for (const version of scopedVersions) {
      const key = `${change.id}:${version.id}`;
      const citation = scopedCitations.find(row => row.content_version_id === version.id && row.fact_id === change.fact_id);
      if (citation) {
        result.set(key, { change_id: change.id, fact_id: change.fact_id, fact_code: change.code, fact_title: change.title, content_id: version.content_id,
          content_version_id: version.id, version_number: version.version_number, title: version.title, confidence: 'confirmed',
          reason: `A saved review finding cites ${citation.cited_code || change.code} for this exact content version.`, matched_text: citation.cited_passage || change.code });
        continue;
      }
      const body = normalized(`${version.body_text}\n${version.alt_text ?? ''}`);
      const match = snippets(change).find(candidate => body.includes(normalized(candidate)));
      if (match) result.set(key, { change_id: change.id, fact_id: change.fact_id, fact_code: change.code, fact_title: change.title, content_id: version.content_id,
        content_version_id: version.id, version_number: version.version_number, title: version.title, confidence: 'possible',
        reason: 'The fact wording appears in this saved content version, but no verified finding citation links the two.', matched_text: match });
    }
  }
  return [...result.values()].sort((a, b) => a.confidence.localeCompare(b.confidence) || b.version_number - a.version_number || a.title.localeCompare(b.title));
}
