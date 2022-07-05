/* eslint-disable no-undef */
import express from "express";
import upload from "../../config/multer.config.js";
import { uploadRateLimiter } from "../../config/ratelimiter.config.js";
import GenericResponse from "../../helpers/dto/generic.response.js";
import userRole from "../../helpers/user.roles.js";
import authenticate from "../../middleware/authentication.js";
import authorize from "../../middleware/authorization.js";
import * as service from "../../services/product.service.js";

const productRoute = express.Router();

const uploadFields = upload.fields([
    { name: "thumb", maxCount: process.env.THUMB_IMG_LIMIT },
    { name: "main", maxCount: process.env.MAIN_IMG_LIMIT }
]);

productRoute.get("/get", async (req, res) => {

    if (!req.query.productId) {
        const response = new GenericResponse(400, "Missing Query Field");
        return res.status(response.statusCode).json(response)
    }

    const response = await service.getProduct(req.query.productId);
    return res.status(response.statusCode).json(response);

})

productRoute.get("/all", async (req, res) => {

    if (!req.query.lim || !req.query.off || !req.query.cat) {
        const response = new GenericResponse(400, "Missing Query Fields");
        return res.status(response.statusCode).json(response)
    }

    const response = await service.getProducts(req.query);
    return res.status(response.statusCode).json(response);
});

productRoute.post("/cart-products", async (req, res) => {

    if (req.body.values === 0) {
        const response = new GenericResponse(400, "Missing Product IDs");
        return res.status(response.statusCode).json(response)
    }

    const response = await service.getCartProducts(req.body);
    return res.status(response.statusCode).json(response);
});

productRoute.get("/pending-requests", authenticate,
    authorize([userRole.MANAGER]), async (req, res) => {

        try {

            const response = await service.getPendingProductRequests();
            return res.status(response.statusCode).json(response);

        } catch (err) {
            console.error(err);
        }

    });

productRoute.post("/add",
    uploadRateLimiter,
    authenticate,
    authorize([userRole.DEO, userRole.SUPER_ADMIN]),
    uploadFields,
    fileErrorHandler,
    async (req, res) => {

        try {

            if (req.files && Object.keys(req.files).length !== 0) {

                if (req.token.role === userRole.DEO) {
                    const response = await service.addCreateProductRequest(
                        req.body.data,
                        req.files,
                        req.token);

                    return res.status(response.statusCode).json(response);
                }

                //Super Admin
                const response = await service.createProduct(req.body.data, req.files);
                return res.status(response.statusCode).json(response);
            }

            const response = new GenericResponse(422, "Error uploading images");
            return res.status(response.statusCode).json(response);

        } catch (err) {
            console.error(err);
        }

    });

productRoute.post("/pending-request/accept",
    authenticate,
    authorize([userRole.MANAGER]),
    async (req, res) => {

        try {

            if (!req.query.id) {
                const response = new GenericResponse(400, "Invalid ID");
                return res.status(response.statusCode).json(response);
            }

            const response = await service.acceptProductRequest(req.query.id);
            return res.status(response.statusCode).json(response);

        } catch (err) {
            console.error(err);
        }
    });

productRoute.post("/pending-request/reject",
    authenticate,
    authorize([userRole.MANAGER]),
    async (req, res) => {

        try {

            if (!req.query.id) {
                const response = new GenericResponse(400, "Invalid ID");
                return res.status(response.statusCode).json(response);
            }

            const response = await service.rejectProductRequest(req.query.id, req.query.reason);
            return res.status(response.statusCode).json(response);

        } catch (err) {
            console.error(err);
        }
    });

productRoute.patch("/update",
    uploadRateLimiter,
    authenticate,
    authorize([userRole.DEO]),
    uploadFields,
    fileErrorHandler,
    async (req, res) => {

        try {

            if (req.files) {
                const response = await service
                    .addUpdateProductRequest(req.body.data, req.files, req.token);
                return res.status(response.statusCode).json(response);
            }

            const response = new GenericResponse(501, "Could not process the request");
            return res.status(response.statusCode).json(response);

        } catch (err) {
            console.error(err);
        }

    });

productRoute.post("/delete",
    authenticate,
    authorize([userRole.DEO]),
    async (req, res) => {

        try {

            if (!req.query.id) {
                const response = new GenericResponse(400, "Invalid ID");
                return res.status(response.statusCode).json(response);
            }

            const response = await service.addDeleteProductRequest(req.query.id, req.token);
            return res.status(response.statusCode).json(response);

        } catch (err) {
            console.error(err);
        }

    });

function fileErrorHandler(err, _req, res, next) {
    switch (err) {
        case "UNSUPPORTED_MEDIA_TYPE": return res.status(415).json({
            message: "NOT_AN_IMAGE"
        });
        case "CONTENT_LENGTH_ERR": return res.sendStatus(400);
        case "MEDIA_SIZE_REACHED": return res.status(415).json({
            message: `EXCEEDS_${parseInt(Math.round(process.env.FILE_SIZE_LIMIT / 1000000))}MB_LIMIT`
        });
        default: next();
    }
}

export default productRoute;