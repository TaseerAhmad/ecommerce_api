import express from "express";
import GenericResponse from "../../helpers/dto/generic.response.js";
import role from "../../helpers/user.roles.js";
import authenticate from "../../middleware/authentication.js";
import authorize from "../../middleware/authorization.js";
import * as service from "../../services/category.service.js";

const categoryRouter = express.Router();

//PUBLIC ROUTE
//all?off=&lim=
categoryRouter.get("/all", async (req, res) => {

    try {

        if (!req.query.off || !req.query.lim) {
            const response = new GenericResponse(400, "Invalid query format");
            return res.status(response.statusCode).json(response);
        }

        const response = await service.fetchAll(req.query);
        return res.status(response.statusCode).json(response);

    } catch (err) {
        console.error(err);
    }

});

categoryRouter.get("/pending-requests", authenticate,
    authorize([role.MANAGER, role.DEO]), async (req, res) => {

        try {

            const response = await service.getPendingCategoryRequests(req.token);
            return res.status(response.statusCode).json(response);

        } catch (err) {
            console.error(err);
        }

    });

categoryRouter.post("/add", authenticate,
    authorize([role.DEO, role.SUPER_ADMIN]), async (req, res) => {

        try {

            if (!req.query.name) {
                const response = new GenericResponse(400, "Invalid fields");
                return res.status(response.statusCode).json(response);
            }

            if (req.token.role === role.DEO) {
                req.query.description = "EMPTY DESCRIPTION";
                const response = await service.createAddCategoryRequest(req.query, req.token);
                return res.status(response.statusCode).json(response);
            }

            const response = await service.createCategory(req.body, req.token);
            return res.status(response.statusCode).json(response);

        } catch (err) {
            console.error(err);
        }

    });

categoryRouter.post("/update", authenticate,
    authorize([role.DEO, role.SUPER_ADMIN]), async (req, res) => {

        try {

            if (!req.query.id) {
                return res.status(400).json({
                    message: "Invalid ID",
                    statusCode: 400
                });
            }

            if (Object.keys(req.body).length === 1) {
                return res.status(204).json({
                    message: "Empty request",
                    statusCode: 204
                });
            }

            if (req.token.role === role.DEO) {
                const response = await service.createUpdateCategoryRequest(req.query, req.token);
                return res.status(response.statusCode).json(response);
            }

            const response = await service.updateCategory(req.body);
            return res.status(response.statusCode).json(response);

        } catch (err) {
            console.error(err);
        }

    });

categoryRouter.delete("/delete", authenticate,
    authorize([role.DEO, role.SUPER_ADMIN]), async (req, res) => {

        try {

            if (!req.query.id) {
                const response = new GenericResponse(400, "Invalid ID");
                return res.status(response.statusCode).json(response);
            }

            if (req.token.role === role.DEO) {
                const response = await service.createDeleteCategoryRequest(req.query.id, req.token);
                return res.status(response.statusCode).json(response);
            }

            const response = await service.deleteCategory(req.query.id, req.token);
            return res.status(response.statusCode).json(response);

        } catch (err) {
            console.error(err);
        }

    });

categoryRouter.post("/accept", authenticate,
    authorize([role.MANAGER]), async (req, res) => {

        try {

            if (!req.query.id) {
                const response = new GenericResponse(400, "Invalid ID");
                return res.status(response.statusCode).json(response);
            }

            const response = await service.acceptCategoryRequest(req.query.id);
            return res.status(response.statusCode).json(response);

        } catch (err) {
            console.error(err);
        }

    });

categoryRouter.post("/reject", authenticate,
    authorize([role.MANAGER, role.SUPER_ADMIN]), async (req, res) => {

        try {

            if (!req.query.id || !req.query.reason) {
                const response = new GenericResponse(400, "Invalid Fields");
                return res.status(response.statusCode).json(response);
            }

            const response = await service.rejectCategoryRequest(req.query);
            return res.status(response.statusCode).json(response);

        } catch (err) {
            console.error(err);
        }

    });

export default categoryRouter;