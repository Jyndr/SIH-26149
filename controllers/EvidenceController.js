import Evidence from "../model/EvidenceSchema.js";
import Case from "../model/CaseSchema.js";


// add evidence
// get evidence
// get case evidence


export const AddEvidence = async (req, res) => {
    try {

        const { caseId } = req.params;

        if (!caseId) {
            return res.status(400).json({
                message: "Please Provide CaseId"
            });
        }

        if (!req.file) {
            return res.status(400).json({
                message: "Please Upload Evidence"
            });
        }

        const existingCase = await Case.findOne({
            caseId: caseId
        });

        if (!existingCase) {
            return res.status(404).json({
                message: "Case not found"
            });
        }

        // SHA-256 calculation will be added here
        // after we decide how the file upload/storage works

        const evidence = await Evidence.create({
            caseId: existingCase._id,
            filename: req.file.originalname,
            size: req.file.size,
            sha256: "TEMP",
            storagePath: req.file.path
        });

        res.status(201).json({
            message: "Evidence added successfully",
            evidence
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            message: "Error adding evidence"
        });
    }
};


export const GetEvidence = async (req, res) => {
    try {

        const { evidenceId } = req.params;

        if (!evidenceId) {
            return res.status(400).json({
                message: "Please Provide EvidenceId"
            });
        }

        const evidence = await Evidence.findOne({
            evidenceId
        });

        if (!evidence) {
            return res.status(404).json({
                message: "Evidence not found"
            });
        }

        res.status(200).json({
            message: "Evidence fetched successfully",
            evidence
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            message: "Error fetching evidence"
        });
    }
};


export const GetCaseEvidence = async (req, res) => {
    try {

        const { caseId } = req.params;

        if (!caseId) {
            return res.status(400).json({
                message: "Please Provide CaseId"
            });
        }

        const existingCase = await Case.findOne({
            caseId
        });

        if (!existingCase) {
            return res.status(404).json({
                message: "Case not found"
            });
        }

        const evidence = await Evidence.find({
            caseId: existingCase._id
        }).sort({
            createdAt: -1
        });

        res.status(200).json({
            message: "Case evidence fetched successfully",
            evidence
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            message: "Error fetching case evidence"
        });
    }
};