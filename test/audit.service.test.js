import assert from 'node:assert/strict';
import test from 'node:test';
import AuditLog from '../src/models/AuditLog.js';
import auditService from '../src/services/audit/audit.service.js';

test('verifyThrough detects a directly tampered audit record', async () => {
  const entries = [];
  const original = { findOne: AuditLog.findOne, find: AuditLog.find, create: AuditLog.create };

  AuditLog.findOne = (query) => {
    const entry = query.auditId
      ? entries.find((item) => item.auditId === query.auditId)
      : entries.filter((item) => String(item.caseId) === String(query.caseId)).at(-1);
    return { sort: () => ({ lean: async () => entry }), lean: async () => entry };
  };
  AuditLog.find = (query) => ({
    sort: () => ({ lean: async () => entries.filter((item) => String(item.caseId) === String(query.caseId)) })
  });
  AuditLog.create = async (entry) => {
    entries.push({ ...entry, _id: entries.length + 1 });
    return entries.at(-1);
  };

  try {
    const base = { caseId: 'case-1', actor: 'user-1', target: 'Case CASE-1' };
    const first = await auditService.record({ ...base, operation: 'CASE_CREATED' });
    const second = await auditService.record({ ...base, operation: 'CASE_UPDATED', details: { status: 'OPEN' } });

    assert.deepEqual(await auditService.verifyThrough(second.auditId), { valid: true, checkedEntries: 2 });

    // Simulates an out-of-band database edit that bypasses Mongoose immutability.
    entries[1].details.status = 'CLOSED';
    assert.deepEqual(await auditService.verifyThrough(second.auditId), {
      valid: false,
      checkedEntries: 2,
      brokenAt: second.auditId
    });
    assert.equal(first.previousHash, null);
  } finally {
    AuditLog.findOne = original.findOne;
    AuditLog.find = original.find;
    AuditLog.create = original.create;
  }
});
