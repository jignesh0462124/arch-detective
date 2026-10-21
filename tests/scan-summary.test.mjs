import assert from 'node:assert/strict';
import { countSeverities, healthScore, riskPosture, normalizeScanSummary } from '../src/lib/api/scanSummary.ts';
import { escapeHtml } from '../src/lib/api/escapeHtml.ts';

const counts = countSeverities([{ severity: 'high' }, { severity: 'medium' }]);
assert.deepEqual(counts, { critical: 0, high: 1, medium: 1, low: 0 });
assert.equal(healthScore(counts), 92);
assert.equal(riskPosture(counts), 'High');
assert.equal(riskPosture(countSeverities([])), 'Minimal');
assert.equal(healthScore(countSeverities([])), 100);
assert.deepEqual(countSeverities([{ severity: 'CRITICAL' }, { severity: 'low' }, { severity: 'unknown' }]), { critical: 1, high: 0, medium: 0, low: 1 });
assert.equal(healthScore(countSeverities(Array(100).fill({ severity: 'critical' }))), 8);
assert.equal(normalizeScanSummary({ findings: [{ severity: 'high' }], severity_counts: { critical: 0, high: 0, medium: 1, low: 0 }, summary: { overall_posture: 'Medium' } }).summary.overall_posture, 'High');
assert.equal(escapeHtml('<img src=x onerror="alert(1)">&'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&amp;');
console.log('PASS: 9 scan-summary and report-escaping regression checks');
