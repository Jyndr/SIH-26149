import auditService from '../services/audit/audit.service.js';

const parsePagination = (query) => ({
  page: Math.max(Number.parseInt(query.page, 10) || 1, 1),
  limit: Math.min(Math.max(Number.parseInt(query.limit, 10) || 50, 1), 100)
});

const auditController = {
  listAll: async (req, res, next) => {
    try {
      const result = await auditService.listAll(parsePagination(req.query));
      res.json({
        success: true,
        data: result.entries,
        pagination: { total: result.total, page: result.page, limit: result.limit }
      });
    } catch (error) {
      next(error);
    }
  },

  verifyChain: async (req, res, next) => {
    try {
      const targetId = req.case?._id || req.params.caseId || req.query.caseId;
      const result = await auditService.verifyChain(targetId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  listByCase: async (req, res, next) => {
    try {
      const targetId = req.case?._id || req.params.caseId;
      const result = await auditService.listByCase(targetId, parsePagination(req.query));
      res.json({
        success: true,
        data: result.entries,
        pagination: { total: result.total, page: result.page, limit: result.limit }
      });
    } catch (error) {
      next(error);
    }
  },

  getLogsByEntity: async (req, res, next) => {
    try {
      const { entityType, entityId } = req.params;
      const logs = await auditService.getLogsByEntity(entityType, entityId);
      res.json({ success: true, data: logs });
    } catch (error) {
      next(error);
    }
  },

  getLogsByUser: async (req, res, next) => {
    try {
      const logs = await auditService.getLogsByUser(req.user.id);
      res.json({ success: true, data: logs });
    } catch (error) {
      next(error);
    }
  }
};

export default auditController;
