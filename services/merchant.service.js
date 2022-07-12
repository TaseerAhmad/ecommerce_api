import mongoose from "mongoose";
import validator from "validator";
import GenericResponse from "../helpers/dto/generic.response.js";
import userRole from "../helpers/user.roles.js";
import Merchant from "../models/Merchant.js";
import MerchantRequest from "../models/MerchantRequest.js";
import User from "../models/User.js";
import { getMerchantUserProducts } from "../services/product.service.js";

async function applyForMerchantAccount(merchantRequest, token) {
    const genericResponse = new GenericResponse();

    try {
        const sanitized = {
            requestedBy: mongoose.Types.ObjectId(token.id),
            brand: validator.trim(merchantRequest.brand),
            description: validator.trim(merchantRequest.description),
            businessContact: {
                email: validator.trim(merchantRequest.email),
                phone: validator.trim(merchantRequest.phone)
            }
        };

        if (validator.isEmpty(sanitized.brand) ||
            !validator.isAlpha(sanitized.brand) ||
            sanitized.brand.length > 100) {

            genericResponse.statusCode = 400;
            genericResponse.message = "Invalid Brand Name";
            return genericResponse;
        }

        if (validator.isEmpty(sanitized.brand) ||
            sanitized.description.length > 255) {

            genericResponse.statusCode = 400;
            genericResponse.message = "Invalid Description";
            return genericResponse;
        }

        if (!validator.isEmail(sanitized.businessContact.email)) {
            genericResponse.statusCode = 400;
            genericResponse.message = "Invalid Email";
            return genericResponse;
        }

        if (!validator.isMobilePhone(sanitized.businessContact.phone, "en-PK")) {
            genericResponse.statusCode = 400;
            genericResponse.message = "Invalid Phone";
            return genericResponse;
        }

        const existingBrandPromise = Merchant.findOne({ brand: sanitized.brand }, { brand: 1 })
            .lean();

        const existingMerchantReqPromise = MerchantRequest.findOne({
            brand: sanitized.brand
        }, { requestedBy: 1 }).lean();


        const [existingBrand, existingMerchReq] = await Promise.all(
            [existingBrandPromise, existingMerchantReqPromise]);

        if (existingBrand) {
            genericResponse.statusCode = 409;
            genericResponse.message = "Brand Name Unavailable";
            return genericResponse;
        }

        if (existingMerchReq) {
            genericResponse.statusCode = 409;
            genericResponse.message = "Merchant Request Conflict";
            return genericResponse;
        }

        await MerchantRequest.create(sanitized);

        genericResponse.statusCode = 201;
        genericResponse.message = "Success";
        return genericResponse;

    } catch (err) {
        console.error(err);

        genericResponse.statusCode = 500;
        genericResponse.message = "Error, Try again";
        return genericResponse;
    }
}

async function getCustomerMerchantRequest(token) {
    const response = new GenericResponse();

    try {

        const request = await MerchantRequest.findOne({
            requestedBy: mongoose.Types.ObjectId(token.id)
        }, { _id: 1}).lean();

        response.statusCode = 200;
        response.message = "Success";
        response.responseData = {
            awaitingConfirmation: Boolean(request)
        };
        return response;

    } catch (err) {
        console.error(err);

        response.statusCode = 500;
        response.message = "Error, try again";
        return response;
    }
}

async function getMerchantRequests() {
    const response = new GenericResponse();

    try {

        const requests = await MerchantRequest.find()
            .populate("requestedBy", ["__id", "email", "firstName", "lastName"])
            .exec();

        response.statusCode = 200;
        response.message = "Success";
        response.responseData = requests;
        return response;

    } catch (err) {
        console.error(err);

        response.statusCode = 500;
        response.message = "Error, try again";
        return response;
    }
}

async function acceptMerchantRequest(requestId, token) {
    const response = new GenericResponse();

    try {
        const merchReqId = validator.trim(requestId);

        if (!mongoose.isValidObjectId(merchReqId)) {
            response.statusCode = 400;
            response.message = "Invalid ID";
            return response;
        }

        const request = await MerchantRequest.findById(merchReqId);

        if (!request) {
            response.statusCode = 404;
            response.message = "No Request Found";
            return response;
        }

        const session = await mongoose.startSession();
        await session.withTransaction(async () => {

            await MerchantRequest.findByIdAndRemove(merchReqId, {
                session: session
            });

            const newMerchant = await Merchant.create([{
                userId: request.requestedBy,
                brand: request.brand,
                description: request.description,
                businessContact: request.businessContact,
                addedBy: mongoose.Types.ObjectId(token.id)
            }], { session: session });

            await User.findByIdAndUpdate(request.requestedBy, {
                merchantId: newMerchant[0]._id,
                role: userRole.MERCHANT
            }, { session: session });

        });
        await session.endSession();

        response.statusCode = 201;
        response.message = "Merchant Created";
        return response;

    } catch (err) {
        console.error(err);

        response.statusCode = 500;
        response.message = "Error, try again";
        return response;
    }
}

async function rejectMerchantRequest(requestId) {
    const response = new GenericResponse();

    try {
        const merchReqId = validator.trim(requestId);

        if (!mongoose.isValidObjectId(merchReqId)) {
            response.statusCode = 400;
            response.message = "Invalid ID";
            return response;
        }

        const dbId = mongoose.Types.ObjectId(merchReqId);
        const request = await MerchantRequest.findByIdAndDelete(dbId);

        if (!request) {
            response.statusCode = 404;
            response.message = "No Request Found";
            return response;
        }

        response.statusCode = 200;
        response.message = "Request Rejected";
        return response;

    } catch (err) {
        console.error(err);

        response.statusCode = 500;
        response.message = "Error, try again";
        return response;
    }
}

async function getInventory(token) {
    const response = new GenericResponse();

    try {

        const userId = mongoose.Types.ObjectId(token.id);

        const merchant = await Merchant.findOne({ userId: userId }, { _id: 1 }).lean();

        const productServiceResponse = await getMerchantUserProducts(merchant._id);

        return productServiceResponse;

    } catch (err) {
        console.error(err);

        response.statusCode = 500;
        response.message = "Error, try again";
        return response;
    }
}

export {
    applyForMerchantAccount,
    getCustomerMerchantRequest,
    getMerchantRequests,
    acceptMerchantRequest,
    rejectMerchantRequest,
    getInventory
};
