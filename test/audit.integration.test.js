import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

const testDatabaseUri = process.env.TEST_MONGODB_URI;

const request = (server, path, token) => new Promise((resolve, reject) => {
  const req = http.request({ host: '127.0.0.1', port: server.address().port, path, headers: { Authorization: `Bearer ${token}` } }, (res) => {
    let body = '';
    res.on('data', (chunk) => { body += chunk; });
    res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
  });
  req.on('error', reject);
  req.end();
});

test('authenticated audit endpoints list, verify, and detect raw database tampering', { skip: !testDatabaseUri }, async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'audit-integration-test-secret';
  const [{ default: app }, { default: AuditLog }, { default: Case }, { default: User }, { default: auditService }] = await Promise.all([
    import('../src/server.js'), import('../src/models/AuditLog.js'), import('../src/models/Case.js'), import('../src/models/User.js'), import('../src/services/audit/audit.service.js')
  ]);
  await mongoose.connect(testDatabaseUri);
  const suffix = new mongoose.Types.ObjectId().toString();
  let server;
  let user;
  let caseDoc;
  try {
    user = await User.create({ userId: `USR-${suffix}`, name: 'Audit Tester', email: `audit-${suffix}@example.test`, passwordHash: 'not-used' });
    caseDoc = await Case.create({ caseId: `CASE-TEST-${suffix}`, title: 'Audit integration test', createdBy: user._id, investigators: [user._id] });
    await auditService.record({ caseId: caseDoc._id, actor: user._id, operation: 'CASE_CREATED', target: `Case ${caseDoc.caseId}` });
    const second = await auditService.record({ caseId: caseDoc._id, actor: user._id, operation: 'CASE_UPDATED', target: `Case ${caseDoc.caseId}`, details: { status: 'OPEN' } });
    const token = jwt.sign({ userId: user._id.toString(), email: user.email, role: user.role }, process.env.JWT_SECRET);
    server = app.listen(0);

    const listResponse = await request(server, `/api/v1/cases/${caseDoc.caseId}/audit`, token);
    assert.equal(listResponse.status, 200);
    assert.equal(listResponse.body.data.length, 2);
    assert.equal(listResponse.body.data[0].auditId, second.auditId);

    const validResponse = await request(server, `/api/v1/audit/${second.auditId}/verify`, token);
    assert.deepEqual(validResponse.body.data, { valid: true, checkedEntries: 2 });

    await AuditLog.collection.updateOne({ auditId: second.auditId }, { $set: { 'details.status': 'CLOSED' } });
    const tamperedResponse = await request(server, `/api/v1/audit/${second.auditId}/verify`, token);
    assert.deepEqual(tamperedResponse.body.data, { valid: false, checkedEntries: 2, brokenAt: second.auditId });
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (caseDoc) {
      await AuditLog.deleteMany({ caseId: caseDoc._id });
      await Case.deleteOne({ _id: caseDoc._id });
    }
    if (user) await User.deleteOne({ _id: user._id });
    await mongoose.disconnect();
  }
});
