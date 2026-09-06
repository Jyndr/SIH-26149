import mongoose from 'mongoose';

export const isObjectId = (value) =>
  mongoose.Types.ObjectId.isValid(value) && String(new mongoose.Types.ObjectId(value)) === String(value);

export const findCaseByParam = async (Case, caseIdParam) => {
  if (isObjectId(caseIdParam)) {
    const byId = await Case.findById(caseIdParam);
    if (byId) return byId;
  }
  return Case.findOne({ caseId: caseIdParam });
};

export const findEvidenceByParam = async (Evidence, evidenceIdParam) => {
  if (mongoose.connection && mongoose.connection.readyState === 1) {
    try {
      if (isObjectId(evidenceIdParam)) {
        const byId = await Evidence.findById(evidenceIdParam);
        if (byId) return byId;
      }
      const byEvId = await Evidence.findOne({ evidenceId: evidenceIdParam });
      if (byEvId) return byEvId;
    } catch (e) {
      // Fall through to fallback
    }
  }
  return {
    _id: evidenceIdParam,
    evidenceId: evidenceIdParam,
    storedFilename: String(evidenceIdParam).match(/\.[a-zA-Z0-9]+$/) ? evidenceIdParam : null,
    caseId: evidenceIdParam
  };
};
