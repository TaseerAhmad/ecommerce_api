import mongoose from "mongoose";
import validator from "validator";
import GenericResponse from "../helpers/dto/generic.response.js";
import Notification from "../helpers/dto/notification.js";
import messageState from "../helpers/message.states.js";
import Category from "../models/Category.js";
import CategoryRequest from "../models/CategoryRequest.js";
import * as notificationService from "../services/notification.service.js";

async function fetchAll(pagination) {
    const response = new GenericResponse();

    try {

        const limit = parseInt(pagination.lim);
        const offset = parseInt(pagination.off);

        if (isNaN(limit) || isNaN(offset) || limit <= 0 || offset < 0) {
            response.statusCode = 400;
            response.message = "Invalid query";
            return response;
        }

        const result = await Category.paginate({}, { offset, limit });

        response.statusCode = 200;
        response.message = "Success";
        response.responseData = {
            total: result.total,
            limit: result.limit,
            offset: result.offset,
            categories: result.docs
        };

        return response;

    } catch (err) {
        console.error(err);

        response.statusCode = 500;
        response.message = "Error, try again";
        return response;
    }
}

async function createUpdateCategoryRequest(category, token) {
    const response = new GenericResponse();

    try {

        if (!mongoose.isValidObjectId(category.id)) {
            response.statusCode = 400;
            response.message = "Invalid ID";
            return response;
        }

        if (category.name) {
            category.name = validator.trim(category.name);
        }

        if (category.description) {
            category.description = validator.trim(category.description);
        }

        if (category.productCount || category.productCount == 0) {
            const count = category.productCount.toString();

            category.productCount = validator.toInt(count);
            if (isNaN(category.productCount)
                || category.productCount < 0
                || category.productCount >= Number.MAX_VALUE) {
                response.statusCode = 400;
                response.message = "Invalid Product Count";
                return response;
            }
        }

        const existingCategoryId = mongoose.Types.ObjectId(category.id);
        const existingCategory = await Category.findById(existingCategoryId).lean();
        if (!existingCategory) {
            response.statusCode = 404;
            response.message = "No Category Exists";
            return response;
        }

        const pendingRequest = await CategoryRequest.findOne({
            name: new RegExp(`^${category.name}$`, 'i'),
            isUpdate: true
        }, { _id: 1 });

        if (pendingRequest) {
            response.statusCode = 409;
            response.message = `A request already exists on ${category.name}`;
            return response;
        }

        category.updateCategoryId = existingCategoryId;
        const newRequest = await CategoryRequest.create({
            isUpdate: true,
            requestingDeo: mongoose.Types.ObjectId(token.id),
            updateDoc: category
        });

        response.statusCode = 201;
        response.message = "Update Request Submitted";
        response.responseData = newRequest;
        return response;

    } catch (err) {
        console.error(err);

        response.statusCode = 500;
        response.message = "Error, try again";
        return response;
    }
}

async function createDeleteCategoryRequest(categoryId, token) {
    const response = new GenericResponse();

    try {

        if (!mongoose.isValidObjectId(categoryId)) {
            response.statusCode = 400;
            response.message = "Invalid ID";
            return response;
        }

        categoryId = mongoose.Types.ObjectId(categoryId);

        const existingCategory = await Category.findById(categoryId, { _id: 1 }).lean();
        if (!existingCategory) {
            response.statusCode = 404;
            response.message = "No Category Exists";
            return response;
        }

        await CategoryRequest.create({
            isDelete: true,
            deleteDoc: { deleteCategoryId: existingCategory._id },
            requestingDeo: mongoose.Types.ObjectId(token.id)
        });

        response.statusCode = 201;
        response.message = "Delete Request Submitted";
        return response;

    } catch (err) {
        console.error(err);

        response.statusCode = 500;
        response.message = "Error, try again";
        return response;
    }
}

async function createAddCategoryRequest(category, token) {
    const response = new GenericResponse();

    try {

        const sanitized = {
            name: validator.trim(category.name),
            description: validator.trim(category.description)
        };

        const existingCategory = await Category.findOne({
            name: new RegExp(`^${sanitized.name}$`, 'i')
        }, { name: 1 });

        if (existingCategory) {
            response.statusCode = 409;
            response.message = "Category Already Exists";
            return response;
        }

        const pendingRequest = await CategoryRequest.findOne({
            "createDoc.name": new RegExp(`^${sanitized.name}$`, 'i')
        }, { _id: 0 });

        if (pendingRequest) {
            response.statusCode = 409;
            response.message = `A request already exists on ${sanitized.name}`;
            return response;
        }

        const newCategory = await CategoryRequest.create({
            isCreate: true,
            requestingDeo: mongoose.Types.ObjectId(token.id),
            createDoc: {
                name: sanitized.name,
                description: sanitized.description
            }
        });

        response.statusCode = 201;
        response.message = "Create Request Submitted";
        response.responseData = newCategory;
        return response;

    } catch (err) {
        console.error(err);

        response.statusCode = 500;
        response.message = "Error, try again";
        return response;
    }
}

async function rejectCategoryRequest(rejectRequest) {
    const response = new GenericResponse();

    try {

        if (!mongoose.isValidObjectId(rejectRequest.id)) {
            response.statusCode = 400;
            response.message = "Invalid ID";
            return response;
        }

        rejectRequest.reason = validator.trim(rejectRequest.reason);

        if (!rejectRequest.reason) {
            response.statusCode = 400;
            response.message = "Reason must be provided";
            return response;
        }

        rejectRequest.id = mongoose.Types.ObjectId(rejectRequest.id);

        const existingRequest = await CategoryRequest.findById(rejectRequest.id).lean();
        if (!existingRequest) {
            response.statusCode = 404;
            response.message = "No request found";
            return response;
        }

        await CategoryRequest.deleteOne({
            _id: rejectRequest.id
        });

        let requestState;
        if (existingRequest.isCreate) {
            requestState = "CREATE";
        } else if (existingRequest.isUpdate) {
            requestState = "UPDATE";
        } else if (existingRequest.isDelete) {
            requestState = "DELETE";
        } else {
            //TODO Abort transaction
            requestState = "UNKOWN";
        }

        const newNotification = new Notification(
            messageState.REJECT,
            `Your ${requestState} request on Category was rejected`,
            rejectRequest.reason,
            existingRequest.requestingDeo
        );

        const notificationResponse = await notificationService.sendNotification(newNotification);
        if (notificationResponse.statusCode !== 201) {
            return notificationResponse;
        }

        response.statusCode = 200;
        response.message = "Category Request Deleted";
        return response;

    } catch (err) {
        console.error(err);

        response.statusCode = 500;
        response.message = "Error, try again";
        return response;
    }
}

async function acceptCategoryRequest(categoryId) {
    let response = new GenericResponse();
    const session = await mongoose.startSession();

    try {

        if (!mongoose.isValidObjectId(categoryId)) {
            response.statusCode = 400;
            response.message = "Invalid ID";
            return response;
        }

        const pendingRequestId = mongoose.Types.ObjectId(categoryId);

        const pendingRequest = await CategoryRequest.findById(pendingRequestId).lean();
        if (!pendingRequest) {
            response.statusCode = 404;
            response.message = "No Request Found";
            return response;
        }

        const newNotification = new Notification(messageState.ACCEPT);

        session.startTransaction();

        if (pendingRequest.isCreate) {
            newNotification.header = "Your CREATE request on Category was accepted";

            await CategoryRequest.findByIdAndDelete(pendingRequestId, {
                session: session
            });

            response = await createCategory({
                name: pendingRequest.createDoc.name,
                description: pendingRequest.createDoc.description
            }, { id: pendingRequest.requestingDeo }, session);

            if (response.statusCode !== 201) {
                await session.abortTransaction();
            }

        } else if (pendingRequest.isUpdate) {
            newNotification.header = "Your UPDATE request on Category was accepted";

            await CategoryRequest.findByIdAndDelete(pendingRequestId, {
                session: session
            });

            response = await updateCategory(pendingRequest, session);

            if (response.statusCode !== 200) {
                await session.abortTransaction();
            }

        } else if (pendingRequest.isDelete) {
            newNotification.header = "Your DELETE request on Category was accepted";

            await CategoryRequest.findByIdAndDelete(pendingRequestId, {
                session: session
            });

            const deleteId = pendingRequest.deleteDoc.deleteCategoryId;
            response = await deleteCategory(deleteId, session);

            if (response.statusCode !== 200) {
                await session.abortTransaction();
            }

        } else {
            throw new Error("Pending Request consists of invalid states");
        }

        if (session.inTransaction) {
            newNotification.recieverId = pendingRequest.requestingDeo;
            notificationService.sendNotification(newNotification);

            await session.commitTransaction();
        }

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

async function deleteCategory(categoryId, session) {
    const response = new GenericResponse();

    try {
        if (typeof categoryId === "string") {
            categoryId = mongoose.Types.ObjectId(categoryId);
        }

        await Category.findByIdAndRemove(categoryId, { session: session });

        response.statusCode = 200;
        response.message = "Category Deleted";
        return response;

    } catch (err) {
        console.error(err);

        response.statusCode = 500;
        response.message = "Delete Error, try again";
        return response;
    }
}

async function updateCategory(category, session) {
    const response = new GenericResponse();

    try {
        if (typeof category.id === "string") {
            category.id = mongoose.Types.ObjectId(category.id);
        }

        const categoryId = category.updateDoc.updateCategoryId;
        delete category.updateDoc.updateCategoryId;

        const updated = await Category.findOneAndUpdate(categoryId, {
            $set: category.updateDoc
        }, { new: true, session: session }).lean();

        response.statusCode = 200;
        response.message = "Category Updated";
        response.responseData = updated;

        return response;

    } catch (err) {
        console.error(err);

        response.statusCode = 500;
        response.message = "Update Error, try again";
        return response;
    }
}

async function createCategory(category, token, session) {
    const response = new GenericResponse();

    try {

        //Super Admin is creating, hence verified
        if (typeof token.id === "string") {
            token.id = mongoose.Types.ObjectId(token.id);
        }

        const sanitized = {
            createdByUserId: token.id,
            name: validator.trim(category.name),
            description: validator.trim(category.description)
        };

        if (validator.isEmpty(sanitized.name)) {
            response.statusCode = 400;
            response.message = "Invalid Name";
            return response;
        }

        const existingCategory = await Category.findOne({
            name: new RegExp(`^${sanitized.name}$`, 'i')
        }, { name: 1 });
        if (existingCategory) {
            response.statusCode = 409;
            response.message = "Category Already Exists";
            return response;
        }

        const newCategory = await Category.create([{
            createdByUserId: sanitized.createdByUserId,
            description: sanitized.description,
            name: sanitized.name
        }], { session: session });

        response.statusCode = 201;
        response.message = `${category.name} category created!`;
        response.responseData = {
            id: newCategory[0]._id,
            name: newCategory[0].name,
            description: newCategory[0].description,
            createdAt: newCategory[0].createdAt
        };

        return response;

    } catch (err) {
        console.error(err);

        response.statusCode = 500;
        response.message = "Create Error, try again";
        return response;
    }
}

async function getPendingCategoryRequests(token) {
    const response = new GenericResponse();

    try {

        const pendingRequests = await CategoryRequest.find()
            .populate("requestingDeo", ["_id", "email", "firstName", "lastName"])
            .populate("updateDoc.updateCategoryId", ["name", "description"])
            .lean()
            .exec();

        response.statusCode = 200;
        response.message = "Success";
        response.responseData = pendingRequests;
        return response;

    } catch (err) {
        console.error(err);

        response.statusCode = 500;
        response.message = "Error, try again";
        return response;
    }
}

export {
    fetchAll,
    updateCategory,
    deleteCategory,
    createCategory,
    rejectCategoryRequest,
    acceptCategoryRequest,
    createAddCategoryRequest,
    getPendingCategoryRequests,
    createDeleteCategoryRequest,
    createUpdateCategoryRequest
};

