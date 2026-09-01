import Case from '../models/Case.js';
import { findCaseByParam } from '../utils/ids.js';
import logger from '../utils/logger.js';

const authorizeCaseAccess = async (req, res, next) => {
  try {
    const { caseId } = req.params;
    const userId = req.user.id;
    const caseDoc = await findCaseByParam(Case, caseId);

    if (!caseDoc) {
      return res.status(404).json({
        success: false,
        error: { message: 'Case not found' }
      });
    }

    const isCreator = caseDoc.createdBy?.toString() === userId;
    const isInvestigator = caseDoc.investigators?.some((inv) => inv.toString() === userId);

    if (req.user.role !== 'ADMIN' && !isCreator && !isInvestigator) {
      return res.status(403).json({
        success: false,
        error: { message: 'Access denied. You do not have permission to access this case.' }
      });
    }

    req.case = caseDoc;
    next();
  } catch (error) {
    logger.error(`Authorization error: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: { message: 'Authorization check failed' }
    });
  }
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { message: 'Authentication required' }
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: { message: 'Insufficient permissions' }
      });
    }

    next();
  };
};

export { authorizeCaseAccess, requireRole };
