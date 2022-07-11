import express from "express";
import userRole from "../../helpers/user.roles.js";
import authenticate from "../../middleware/authentication.js";
import authorize from "../../middleware/authorization.js";
import * as reviewService from "../../services/review.service.js";

const reviewRouter = express.Router();

//Paginated route
reviewRouter.get("/all", async (req, res) => {
    
    const response = await reviewService.getProductReviews(req.query.productId);
    return res.status(response.statusCode).json(response);

});

reviewRouter.get("/user-review",
    authenticate,
    authorize([userRole.CUSTOMER]),
    async (req, res) => {

        const response = await reviewService.getUserReview(req.query.productId, req.token);
        return res.status(response.statusCode).json(response);

    });

reviewRouter.post("/post",
    authenticate,
    authorize([userRole.CUSTOMER]),
    async (req, res) => {

        const response = await reviewService.createReview(req.query, req.token);
        return res.status(response.statusCode).json(response);

    });

reviewRouter.delete("/delete",
    authenticate,
    authorize([userRole.CUSTOMER, userRole.MANAGER]),
    async (req, res) => {

        const response = await reviewService.deleteReview(req.query.reviewId, req.token);
        return res.status(response.statusCode).json(response);

    });


export default reviewRouter;