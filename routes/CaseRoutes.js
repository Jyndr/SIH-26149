import express from "express";

import {
    CreateCase,
    GetCase,
    GetRecentCase
} from "../controllers/caseController.js";

const router = express.Router();

router.post("/create", CreateCase);

router.get("/recent", GetRecentCase);

router.get("/:caseId", GetCase);


export default router;