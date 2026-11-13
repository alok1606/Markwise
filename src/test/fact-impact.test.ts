import { describe, expect, it } from 'vitest';
import { buildFactChanges, findFactImpacts, type FactHistorySnapshot, type FactSnapshot } from '@/lib/fact-impact';

const workspace = 'ws-a';
const fact = (overrides: Partial<FactSnapshot> = {}): FactSnapshot => ({ id: 'fact-a', workspace_id: workspace, code: 'FACT-01', title: 'Onboarding', statement: 'Reduces onboarding time by up to forty percent for teams.', active: true, status: 'approved', version: 2, created_at: '2026-01-01T00:00:00Z', ...overrides });
const history = (version: number, snapshot: Record<string, unknown>, change: 'updated' | 'deleted' = 'updated'): FactHistorySnapshot => ({ fact_id: 'fact-a', workspace_id: workspace, version, change, snapshot, changed_at: `2026-01-0${version + 1}T00:00:00Z` });
const oldSnapshot = { ...fact({ version: 1, statement: 'Cuts onboarding time by up to forty percent for teams.' }) };
const currentFact = fact({ version: 2, statement: 'Reduces onboarding time by up to forty percent for teams.' });

describe('fact impact scan', () => {
  it('reconstructs created, changed and retired fact history from existing snapshots', () => {
    const changes = buildFactChanges(workspace, [currentFact], [history(1, oldSnapshot), history(2, { ...currentFact, active: false }, 'deleted')]);
    expect(changes.map(row => row.kind)).toEqual(['retired', 'changed', 'created']);
    expect(changes[1]).toMatchObject({ old_value: oldSnapshot.statement, new_value: currentFact.statement });
    expect(changes[0]).toMatchObject({ kind: 'retired', new_value: null });
  });

  it('marks exact saved finding citations confirmed and unlinked wording matches possible', () => {
    const [change] = buildFactChanges(workspace, [currentFact], [history(1, oldSnapshot)]);
    const versions = [
      { id: 'v1', content_id: 'c1', workspace_id: workspace, version_number: 1, title: 'Campaign A', body_text: '', created_at: '' },
      { id: 'v2', content_id: 'c2', workspace_id: workspace, version_number: 2, title: 'Campaign B', body_text: `Claim: ${oldSnapshot.statement}`, created_at: '' },
    ];
    const impacts = findFactImpacts(workspace, [change!], versions, [{ workspace_id: workspace, content_id: 'c1', content_version_id: 'v1', fact_id: 'fact-a', cited_code: 'FACT-01', cited_passage: 'approved source passage' }]);
    expect(impacts).toEqual(expect.arrayContaining([
      expect.objectContaining({ content_id: 'c1', confidence: 'confirmed', reason: expect.stringContaining('saved review finding cites') }),
      expect.objectContaining({ content_id: 'c2', confidence: 'possible', reason: expect.stringContaining('no verified finding citation') }),
    ]));
  });

  it('does not return matches or citations from a different workspace', () => {
    const [change] = buildFactChanges(workspace, [currentFact, fact({ id: 'foreign', workspace_id: 'ws-b' })], [history(1, oldSnapshot)]);
    const impacts = findFactImpacts(workspace, [change!], [{ id: 'foreign-v', content_id: 'foreign-c', workspace_id: 'ws-b', version_number: 1, title: 'Foreign', body_text: oldSnapshot.statement, created_at: '' }],
      [{ workspace_id: 'ws-b', content_id: 'foreign-c', content_version_id: 'foreign-v', fact_id: 'fact-a', cited_code: 'FACT-01', cited_passage: '' }]);
    expect(impacts).toEqual([]);
  });

  it('handles new facts and empty scans without inventing impacts', () => {
    const created = buildFactChanges(workspace, [fact({ version: 1 })], []);
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ kind: 'created', old_value: null, new_value: fact({ version: 1 }).statement });
    expect(findFactImpacts(workspace, [], [], [])).toEqual([]);
  });

  it('scans image descriptions as possible wording references too', () => {
    const [change] = buildFactChanges(workspace, [currentFact], [history(1, oldSnapshot)]);
    const impacts = findFactImpacts(workspace, [change!], [{ id: 'image-v', content_id: 'image-c', workspace_id: workspace, version_number: 1, title: 'Image post', body_text: '', alt_text: oldSnapshot.statement, created_at: '' }], []);
    expect(impacts).toEqual([expect.objectContaining({ content_id: 'image-c', confidence: 'possible' })]);
  });
});
