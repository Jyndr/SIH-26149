import Case from '../models/Case.js';
import { findCaseByParam } from '../utils/ids.js';
import logger from '../utils/logger.js';

const authorizeCaseAccess = async (req, res, next) => {
  try {
    const { caseId } = req.params;
    const userId = req.user.id;
    let caseDoc = await findCaseByParam(Case, caseId);

    if (!caseDoc) {
      try {
        caseDoc = await Case.create({
          caseId,
          title: `Investigation Case ${caseId}`,
          description: 'Digital forensic investigation workspace.',
          createdBy: userId,
          investigators: [userId],
          status: 'OPEN'
        });
        logger.info(`Auto-created case ${caseId} for user ${userId}`);
      } catch {
        caseDoc = await findCaseByParam(Case, caseId);
      }
    }

    if (!caseDoc) {
      return res.status(404).json({
        success: false,
        error: { message: 'Case not found' }
      });
    }

    const isCreator = caseDoc.createdBy?.toString() === String(userId);
    const isInvestigator = caseDoc.investigators?.some((inv) => inv?.toString() === String(userId));

    if (req.user.role !== 'ADMIN' && !isCreator && !isInvestigator) {
      if (req.user.role === 'INVESTIGATOR') {
        caseDoc.investigators = caseDoc.investigators || [];
        caseDoc.investigators.push(userId);
        await caseDoc.save().catch(() => { });
      } else {
        return res.status(403).json({
          success: false,
          error: { message: 'Access denied. You do not have permission to access this case.' }
        });
      }
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
