import express from "express";
import role from "../../helpers/user.roles.js";
import authenticate from "../../middleware/authentication.js";
import authorize from "../../middleware/authorization.js";
import * as service from "../../services/merchant.service.js";

const merchantRoute = express.Router();

merchantRoute.get("/inventory",
    authenticate,
    authorize([role.MERCHANT]), async (req, res) => {

        try {

            const response = await service.getInventory(req.token);
            return res.status(response.statusCode).json(response);

        } catch (err) {
            console.error(err);
        }

    });

merchantRoute.post("/apply",
    authenticate,
    authorize([role.CUSTOMER]), async (req, res) => {

        try {

            if (!req.body.brand || !req.body.description
                || !req.body.email || !req.body.phone) {

                return res.status(400).json({
                    message: "Invalid Fields"
                });
            }

            const response = await service.applyForMerchantAccount(req.body, req.token);
            return res.status(response.statusCode).json(response);

        } catch (err) {
            console.error(err);
        }
    });

merchantRoute.get("/pending-requests",
    authenticate,
    authorize([role.CUSTOMER, role.ADMIN,
    role.MANAGER, role.SUPER_ADMIN]), async (req, res) => {

        try {

            if (req.token.role === role.CUSTOMER) {
                const response = await service.getCustomerMerchantRequest(req.token);
                return res.status(response.statusCode).json(response);
            }

            const response = await service.getMerchantRequests();
            return res.status(response.statusCode).json(response);

        } catch (err) {
            console.error(err);
        }

    });

merchantRoute.post("/pending-request/accept",
    authenticate,
    authorize([role.MANAGER, role.SUPER_ADMIN]), async (req, res) => {

        try {

            if (!req.query.requestId) {
                return res.status(400).json({
                    message: "Invalid ID"
                });
            }

            const response = await service.acceptMerchantRequest(req.query.requestId, req.token);
            return res.status(response.statusCode).json(response);

        } catch (err) {
            console.error(err);
        }

    });

merchantRoute.post("/pending-request/reject",
    authenticate,
    authorize([role.MANAGER, role.SUPER_ADMIN]), async (req, res) => {

        try {

            if (!req.query.requestId) {
                return res.status(400).json({
                    message: "Invalid ID"
                });
            }

            const response = await service.rejectMerchantRequest(req.query.requestId, req.token);
            return res.status(response.statusCode).json(response);

        } catch (err) {
            console.error(err);
        }

    });

export default merchantRoute;