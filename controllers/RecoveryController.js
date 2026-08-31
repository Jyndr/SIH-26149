import Evidence from "../model/EvidenceSchema.js";
import Recovery from "../model/RecoverySchema.js";


// start recovery
// get all recovery
// get recovery of particular evidence


export const StartRecovery = async (req, res) => {
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

        const recovery = await Recovery.create({
            recoveryId: `REC-${Date.now()}`,
            evidenceId: evidence._id,
            status: "processing",
            startedAt: new Date()
        });

        res.status(201).json({
            message: "Recovery started successfully",
            recovery
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            message: "Error starting recovery"
        });

    }
};


export const GetRecovery = async (req, res) => {
    try {

        const recovery = await Recovery.find()
            .sort({ createdAt: -1 });

        res.status(200).json({
            message: "Recovery fetched successfully",
            recovery
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            message: "Error fetching recovery"
        });

    }
};


export const GetEvidenceRecovery = async (req, res) => {
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

        const recovery = await Recovery.find({
            evidenceId: evidence._id
        }).sort({ createdAt: -1 });

        res.status(200).json({
            message: "Evidence recovery fetched successfully",
            recovery
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            message: "Error fetching evidence recovery"
        });

    }
};