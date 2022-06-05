import express from "express";
import GenericResponse from "../../helpers/dto/generic.response.js";
import userRole from "../../helpers/user.roles.js";
import authenticate from "../../middleware/authentication.js";
import authorize from "../../middleware/authorization.js";
import * as service from "../../services/address.service.js";

const addressRouter = express.Router();

addressRouter.get("/saved-addresses", authenticate,
    authorize([userRole.CUSTOMER]), async (req, res) => {

        try {

            const response = await service.getAddress(req.token);
            return res.status(response.statusCode).json(response);

        } catch (err) {
            console.error(err);
        }

    });

addressRouter.post("/add", authenticate,
    authorize([userRole.CUSTOMER]), async (req, res) => {

        try {
            if (!req.body.contact || !req.body.city || !req.body.address) {
                const response = new GenericResponse(400, "Invalid fields");
                return res.status(response.statusCode).json(response);
            }

            const response = await service.addAddress(req.body, req.token);
            return res.status(response.statusCode).json(response);

        } catch (err) {
            console.error(err);
        }

    });

addressRouter.patch("/update", authenticate,
    authorize([userRole.CUSTOMER]), async (req, res) => {

        try {

            if (!req.body.id && !req.body.contact
                && !req.body.city && !req.body.address) {
                return res.status(204).json({
                    message: "Empty request",
                    statusCode: 204
                });
            }

            if (!req.body.id) {
                return res.status(400).json({
                    message: "Invalid ID",
                    statusCode: 400
                });
            }

            const response = await service.updateAddress(req.body);
            return res.status(response.statusCode).json(response);

        } catch (err) {
            console.error(err);
        }

    });

addressRouter.delete("/delete", authenticate,
    authorize([userRole.CUSTOMER]), async (req, res) => {

        try {

            if (!req.body.id) {
                const response = new GenericResponse(400, "Invalid Field");
                return res.status(response.statusCode).json(response);
            }

            const response = await service.deleteAddress(req.body.id, req.token);
            return res.status(response.statusCode).json(response);

        } catch (err) {
            console.error(err);
        }

    });

export default addressRouter;