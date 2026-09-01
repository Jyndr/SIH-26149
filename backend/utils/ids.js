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
  if (isObjectId(evidenceIdParam)) {
    const byId = await Evidence.findById(evidenceIdParam);
    if (byId) return byId;
  }
  return Evidence.findOne({ evidenceId: evidenceIdParam });
};
