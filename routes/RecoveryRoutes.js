import express from "express";
import { StartRecovery, GetRecovery, GetEvidenceRecovery } from "../controllers/RecoveryController.js";

const router = express.Router();

router.get("/evidence/:evidenceId", GetEvidenceRecovery);

router.post("/:evidenceId", StartRecovery);

router.get("/", GetRecovery);



export default router;