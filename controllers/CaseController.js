import { Case } from "../model/CaseSchema.js";

// create case
// get case
// get recent cases


export const CreateCase = async (req, res) => {
    try {

        const { title, description } = req.body;

        if (!title) {
            return res.status(400).json({
                message: "Please Enter the title"
            });
        }

        const newCase = await Case.create({
            title,
            description
        });

        if (!newCase) {
            return res.status(404).json({
                message: "Case not found"
            });
        }

        res.status(201).json({
            message: "Case Created Successfully",
            case: newCase,
            caseId: newCase.caseId
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Error creating case",
        });
    }
};


export const GetCase = async (req, res) => {
    try {

        if (!req.body.caseId) {
            return res.status(400).json({
                message: "Please Provide CaseId"
            })
        }

        const newCase = await Case.findOne({ caseId: req.params });

        if (!newCase) {
            return res.status(404).json({
                message: "Case not found"
            });
        }


        res.status(200).json({
            message: "Case fetched successfully",
            newCase
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Error fetching case",
        });

    }
};


export const GetRecentCase = async (req, res) => {
    try {

        const cases = await Case.find()
            .sort({ createdAt: -1 })
            .limit(10);

        res.status(200).json({
            message: "Recent cases fetched successfully",
            cases
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Error fetching recent cases",
        });

    }
};
