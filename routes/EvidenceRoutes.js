import express from "express";
import { AddEvidence, GetEvidence, GetCaseEvidence } from "../controllers/EvidenceController.js";

import upload from "../middleware/uploadMiddleware.js";

const router = express.Router();

router.post("/:caseId", upload.single("evidence"), AddEvidence);

router.get("/case/:caseId", GetCaseEvidence);

router.get("/:evidenceId", GetEvidence);


export default router;