import crypto from 'crypto';
import AuditLog from '../../models/AuditLog.js';
import logger from '../../utils/logger.js';

const canonicalize = (value) => {
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  return Object.keys(value).sort().reduce((result, key) => {
    result[key] = canonicalize(value[key]);
    return result;
  }, {});
};

const hashPayload = ({ previousHash, caseId, evidenceId, jobId, actor, operation, target, result, details, timestamp }) =>
  crypto.createHash('sha256').update(JSON.stringify(canonicalize({
    previousHash: previousHash ?? null,
    caseId: String(caseId),
    evidenceId: evidenceId ? String(evidenceId) : null,
    jobId: jobId ? String(jobId) : null,
    actor: String(actor),
    operation,
    target,
    result,
    details: details ?? {},
    timestamp: new Date(timestamp).toISOString()
  }))).digest('hex');

const generateAuditId = () => `AUD-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

const auditService = {
  async record(entry) {
    const { caseId, actor, operation, target, result = 'SUCCESS', evidenceId, jobId, details = {} } = entry;
    if (!caseId || !actor || !operation || !target) throw new Error('Audit entry requires caseId, actor, operation, and target');
    const previous = await AuditLog.findOne({ caseId }).sort({ timestamp: -1, _id: -1 }).lean();
    const timestamp = new Date();
    const previousHash = previous?.recordHash ?? null;
    const payload = { previousHash, caseId, evidenceId, jobId, actor, operation, target, result, details, timestamp };
    const auditLog = await AuditLog.create({ ...payload, auditId: generateAuditId(), recordHash: hashPayload(payload) });
    logger.info(`Audit recorded: ${auditLog.auditId} (${operation})`);
    return auditLog;
  },

  async listByCase(caseId, { page = 1, limit = 50 } = {}) {
    const skip = (page - 1) * limit;
    const [entries, total] = await Promise.all([
      AuditLog.find({ caseId }).populate('actor', 'name email userId role').sort({ timestamp: -1, _id: -1 }).skip(skip).limit(limit),
      AuditLog.countDocuments({ caseId })
    ]);
    return { entries, total, page, limit };
  },

  async getByAuditId(auditId) {
    return AuditLog.findOne({ auditId });
  },

  async verifyChain(caseId) {
    const filter = caseId ? { caseId } : {};
    const entries = await AuditLog.find(filter).sort({ timestamp: 1, _id: 1 }).lean();
    let previousHash = null;
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      const expectedHash = hashPayload({ ...entry, previousHash });
      if (entry.previousHash !== previousHash || entry.recordHash !== expectedHash) {
        return { valid: false, checkedEntries: index + 1, brokenAt: entry.auditId, total: entries.length };
      }
      previousHash = entry.recordHash;
    }
    return { valid: true, checkedEntries: entries.length, total: entries.length };
  },

  async verifyThrough(auditId) {
    const target = await AuditLog.findOne({ auditId }).lean();
    if (!target) return null;
    return this.verifyChain(target.caseId);
  },

  async getLogsByEntity(entityType, entityId) {
    const field = entityType === 'CASE' ? 'caseId' : entityType === 'EVIDENCE' ? 'evidenceId' : 'jobId';
    return AuditLog.find({ [field]: entityId }).sort({ timestamp: -1, _id: -1 });
  },

  async getLogsByUser(userId) {
    return AuditLog.find({ actor: userId }).sort({ timestamp: -1, _id: -1 });
  }
};

export default auditService;
