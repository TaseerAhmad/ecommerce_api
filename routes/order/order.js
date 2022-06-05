import express from "express";
import GenericResponse from "../../helpers/dto/generic.response.js";
import userRole from "../../helpers/user.roles.js";
import authenticate from "../../middleware/authentication.js";
import authorize from "../../middleware/authorization.js";
import * as service from "../../services/order.service.js";

const orderRouter = express.Router();

orderRouter.post("/create", authenticate,
    authorize([userRole.CUSTOMER]), async (req, res) => {

        try {
            
            if (!req.query.productId || !req.query.quantity || !req.query.addressId) {
                const response = new GenericResponse(400, "Invalid Fields");
                return res.status(response.statusCode).json(response);
            }

            const response = await service.placeOrder(req.query, req.token);
            return res.status(response.statusCode).json(response);

        } catch (err) {
            console.error(err);
        }

    });

orderRouter.patch("/update-ticket", authenticate,
    authorize([userRole.MANAGER]), async (req, res) => {

        try {

            if (!req.query.ticketId || !req.query.ticketState) {
                const response = new GenericResponse(400, "Invalid Fields");
                return res.status(response.statusCode).json(response);
            }

            const response = await service.updateOrderState(req.query.ticketId, req.query.ticketState);
            return res.status(response.statusCode).json(response);

        } catch (err) {
            console.error(err);
        }

    });

orderRouter.post("/cancel", authenticate,
    authorize([userRole.CUSTOMER]), async (req, res) => {

        try {

            if (!req.query.orderId) {
                const response = new GenericResponse(400, "ID is required");
                return res.status(response.statusCode).json(response);
            }

            const response = await service.cancelOrder(req.query.orderId);
            return res.status(response.statusCode).json(response);

        } catch (err) {
            console.error(err);
        }

    });

orderRouter.get("/order-ticket-states", authenticate,
    authorize([userRole.MANAGER]), async (req, res) => {

        try {

            const response = await service.getTicketStates();
            return res.status(response.statusCode).json(response);

        } catch (err) {
            console.error(err);
        }

    });

orderRouter.get("/pending-orders", authenticate,
    authorize([userRole.MANAGER]), async (req, res) => {

        try {

            if (!req.query.ticketState) {
                const response = new GenericResponse(400, "Ticket State is required");
                return res.status(response.statusCode).json(response);
            }

            const response = await service.getPendingOrderTickets(req.query.ticketState);
            return res.status(response.statusCode).json(response);

        } catch (err) {
            console.error(err);
        }

    });

export default orderRouter;