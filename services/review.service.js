import mongoose from "mongoose";
import validator from "validator";
import GenericResponse from "../helpers/dto/generic.response.js";
import OrderHistory from "../models/OrderHistory.js";
import Product from "../models/Product.js";
import Review from "../models/Review.js";
import User from "../models/User.js";

async function createReview(review, token) {
    const response = new GenericResponse();
    const session = await mongoose.startSession();

    try {

        if (!review.relatedProduct || !review.text || !review.rating) {
            response.statusCode = 400;
            response.message = "Invalid Fields";
            return response;
        }

        if (!mongoose.isValidObjectId(review.relatedProduct)) {
            response.statusCode = 400;
            response.message = "Invalid Product ID";
            return response;
        } else {
            review.relatedProduct = mongoose.Types.ObjectId(review.relatedProduct);
        }

        review.rating = parseInt(review.rating);
        review.text = validator.trim(review.text);

        if (isNaN(review.rating) || review.rating <= 0 || review.rating > 5) {
            response.statusCode = 400;
            response.message = "Invalid Rating";
            return response;
        }

        if (review.text.length === 0) {
            delete review.text;
        }

        if (await _isAlreadyReviewed(review, token)) {
            response.statusCode = 409;
            response.message = "Review already exists";
            return response;
        }

        const productPromise = Product.findById(review.relatedProduct, { controls: 1, _id: 0 }).lean();
        const reviewerPromise = User.findById(token.id, { firstName: 1, lastName: 1 }).lean();
        const purchasePromise = OrderHistory.findOne({
            $and: [
                { relatedProduct: review.relatedProduct },
                { relatedUser: mongoose.Types.ObjectId(token.id) }
            ]
        }, { _id: 1 }).lean();

        const [product, reviewer, purchaseHistory] = await Promise.all([
            productPromise,
            reviewerPromise,
            purchasePromise
        ]);

        /*  User is attempting to review an unbought item, 
            If Merchant has disallowed such action, do not proceed.
        */
        if (!product.controls.allowNonVerifiedBuyerReviews && !purchaseHistory) {
            response.statusCode = 405;
            response.message = "Only verified buyer can review this product";
            return response;
        }

        if (!product.controls.isPublished) {
            response.statusCode = 403;
            response.message = "Illegal Action";
            return response;
        }

        review.relatedUser = reviewer._id;
        review.isVerifiedPurchase = Boolean(purchaseHistory);
        review.reviewerName = _obfuscateReviewerName(reviewer.firstName, reviewer.lastName);

        session.startTransaction();

        const updatedProduct = await Product.findByIdAndUpdate(review.relatedProduct, {
            $inc: _getIncrObjFromRating(review.rating)
        }, { new: true, session: session });

        if (updatedProduct.rating.count % 5 === 0) {
            const avgRating = _calculateAverageRating(updatedProduct.rating);

            await Product.findByIdAndUpdate(review.relatedProduct, {
                $set: { "rating.average": avgRating }
            }, { session: session });
        }

        const createdReview = await Review.create([review], { session: session });

        await session.commitTransaction();

        response.statusCode = 201;
        response.message = "Review Posted";
        response.responseData = createdReview[0];
        return response;

    } catch (err) {
        console.error(err);

        if (session.inTransaction) {
            await session.abortTransaction();
        }

        response.statusCode = 500;
        response.message = "Error, try again";
        return response;

    } finally {
        await session.endSession();
    }
}

async function getProductReviews(query) {
    const response = new GenericResponse();

    try {

        if (!query.productId || !query.off || !query.lim) {
            response.statusCode = 400;
            response.message = "Invalid Fields";
            return response;
        }

        if (!mongoose.isValidObjectId(query.productId)) {
            response.statusCode = 400;
            response.message = "Invalid Product ID";
            return response;
        } else {
            query.productId = mongoose.Types.ObjectId(query.productId);
        }

        query.off = parseInt(query.off);
        query.lim = parseInt(query.lim);

        if (isNaN(query.off) || isNaN(query.lim) ||
            query.off < 0 || query.lim <= 0 ||
            query.lim === query.off || query.lim > 50) {

            response.statusCode = 400;
            response.message = "Invalid Pagination";
            return response;
        }
     
        const result = await Review.paginate({}, {
            offset: query.off,
            limit: query.lim,
            select: { reviewerName: 1, text: 1, rating: 1, createdDate: 1, isVerifiedPurchase: 1 },
            lean: true,
            sort: { createdDate: -1 }
        });

        result.docs.map((review) => {
            delete review.id;
            delete review._id;
        });

        response.statusCode = 200;
        response.message = "Success";
        response.responseData = {
            total: result.total,
            limit: result.limit,
            offset: result.offset,
            reviews: result.docs
        };

        return response;

    } catch (err) {
        console.error(err);

        response.statusCode = 500;
        response.message = "Error, try again";
        return response;
    }
}

async function _isAlreadyReviewed(review, token) {
    const result = await Review.findOne({
        $and: [
            { relatedProduct: review.relatedProduct },
            { relatedUser: mongoose.Types.ObjectId(token.id) }
        ]
    }, { _id: 1 }).lean();

    return Boolean(result);
}

function _calculateAverageRating(rating) {
    const one = (rating.stats.oneStar ?? 0) * 1;
    const two = (rating.stats.twoStar ?? 0) * 2;
    const three = (rating.stats.threeStar ?? 0) * 3;
    const four = (rating.stats.fourStar ?? 0) * 4;
    const five = (rating.stats.fiveStar ?? 0) * 5;

    const total = one + two + three + four + five;
    const avg = total / rating.count;
    const rounded = Math.round(avg * 10) / 10;

    if (rounded > 5.0) {
        throw new Error("Rating calculation error. Exceeds 5.0 calculation");
    }

    return rounded;
}

function _obfuscateReviewerName(firstName, lastName) {
    const obfuscatedLastName = lastName.charAt(0);
    return `${firstName} ${obfuscatedLastName}.`;
}

function _getIncrObjFromRating(rating) {
    switch (rating) {
        case 1: return { "rating.count": 1, "rating.stats.oneStar": 1 }
        case 2: return { "rating.count": 1, "rating.stats.twoStar": 1 }
        case 3: return { "rating.count": 1, "rating.stats.threeStar": 1 }
        case 4: return { "rating.count": 1, "rating.stats.fourStar": 1 }
        case 5: return { "rating.count": 1, "rating.stats.fiveStar": 1 }

        default: throw new Error("Invalid rating identifier passed");
    }
}

export {
    createReview,
    getProductReviews
};