/* eslint-disable no-undef */
import mongoose from "mongoose";
import validator from "validator";
import { bucket, s3 } from "../config/aws.config.js";
import GenericResponse from "../helpers/dto/generic.response.js";
import Notification from "../helpers/dto/notification.js";
import generateUniqueId from "../helpers/id.generator.js";
import messageState from "../helpers/message.states.js";
import Category from "../models/Category.js";
import Merchant from "../models/Merchant.js";
import Product from "../models/Product.js";
import ProductRequest from "../models/ProductRequest.js";
import { sendNotification } from "../services/notification.service.js";

async function rejectProductRequest(requestId, rejectReason) {
    const response = new GenericResponse();
    const session = await mongoose.startSession();

    try {

        if (!mongoose.isValidObjectId(requestId)) {
            response.statusCode = 400;
            response.message = "Invalid ID";
            return response;
        } else {
            requestId = mongoose.Types.ObjectId(requestId);
        }

        const pendingRequest = await ProductRequest.findById(requestId).lean();
        if (!pendingRequest) {
            response.statusCode = 404;
            response.message = "No Pending Request";
            return response;
        }

        let reqType;
        let imagesToDelete = null;

        if (pendingRequest.isCreate) {

            reqType = "CREATE";
            imagesToDelete = pendingRequest.createDoc.images;

        } else if (pendingRequest.isUpdate) {

            reqType = "UPDATE";
            if (pendingRequest.updateDoc.thumb || pendingRequest.updateDoc.main) {
                imagesToDelete = pendingRequest.updateDoc.images;
            }

        } else if (pendingRequest.isDelete) {
            reqType = "DELETE";
        } else {
            reqType = "UNKOWN";
        }

        session.startTransaction();

        await ProductRequest.findByIdAndDelete(requestId, { session });

        if (imagesToDelete) {
            const result = await _deleteReferencedImages(imagesToDelete);
            if (result.Errors.length !== 0) {
                throw new Error("S3 returned delete errors");
            }
        }

        await session.commitTransaction();

        const notification = new Notification(messageState.REJECT);
        notification.header = `Your ${reqType} request on Product was rejected`;
        notification.recieverId = pendingRequest.requestingDeo;
        notification.text = validator.trim(rejectReason);
        sendNotification(notification);

        response.statusCode = 200;
        response.message = "Request Rejected";
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

async function addDeleteProductRequest(productId, token) {
    const response = new GenericResponse();

    try {

        if (!mongoose.isValidObjectId(productId)) {
            response.statusCode = 400;
            response.message = "Invalid ID";
            return response;
        } else {
            productId = mongoose.Types.ObjectId(productId);
        }

        const existingProduct = await Product.findById(productId, { name: 1 }).lean();
        if (!existingProduct) {
            response.statusCode = 404;
            response.message = "Product not found";
            return response;
        }

        const existingRequest = await ProductRequest.findOne({
            $or: [{
                "createDoc.name": existingProduct.name,
            }, {
                "updateDoc.relatedProductId": productId,
            }, {
                "deleteDoc.relatedProductId": productId
            }]
        }, { requestingDeo: 1 }).lean();

        if (existingRequest) {
            response.statusCode = 409;
            response.message = "A request already exists on the product";
            return response;
        }

        await ProductRequest.create([{
            isDelete: true,
            deleteDoc: {
                relatedProductId: productId
            },
            requestingDeo: mongoose.Types.ObjectId(token.id)
        }]);

        response.statusCode = 201;
        response.message = "Request Submitted";
        return response;

    } catch (err) {
        console.error(err);

        response.statusCode = 500;
        response.message = "Error, try again";
        return response;
    }
}

async function addUpdateProductRequest(productData, images, token) {
    const response = new GenericResponse();

    try {

        const updatedProduct = JSON.parse(productData);

        if (Object.keys(updatedProduct).length === 0) {
            if (Object.keys(images).length !== 0) {
                await _deleteUnReferencedImages(images);
            }

            response.statusCode = 204;
            response.message = "Empty request";
            return response;
        }

        if (!updatedProduct.relatedProductId) {
            if (Object.keys(images).length !== 0) {
                await _deleteUnReferencedImages(images);
            }

            response.statusCode = 400;
            response.message = "Invalid ID";
            return response;
        }

        if (Object.keys(updatedProduct).length === 1) {
            if (Object.keys(images).length !== 0) {
                await _deleteUnReferencedImages(images);
            }

            response.statusCode = 204;
            response.message = "Empty request";
            return response;
        }

        if (!mongoose.isValidObjectId(updatedProduct.relatedProductId)) {
            response.statusCode = 400;
            response.message = "Invalid ID";
            return response;
        } else {
            const mongoId = mongoose.Types.ObjectId(updatedProduct.relatedProductId);
            updatedProduct.relatedProductId = mongoId;
        }

        if (updatedProduct.name) {
            updatedProduct.name = validator.trim(updatedProduct.name);
        }

        if (updatedProduct.description) {
            updatedProduct.description = validator.trim(updatedProduct.description);
        }

        if (updatedProduct.price) {
            const parsedPrice = parseInt(updatedProduct.price);
            if (isNaN(parsedPrice)
                || parsedPrice < 0
                || parsedPrice > Number.MAX_VALUE) {

                response.statusCode = 400;
                response.message = "Invalid Price";
                return response;
            }

            updatedProduct.price = parsedPrice;
        }

        if (updatedProduct.quantity) {
            const parsedQuantity = parseInt(updatedProduct.quantity);
            if (isNaN(parsedQuantity)
                || parsedQuantity < 0
                || parsedQuantity > Number.MAX_VALUE) {

                response.statusCode = 400;
                response.message = "Invalid Quantity";
                return response;
            }

            updatedProduct.quantity = parsedQuantity;
        }

        const existingRequest = await ProductRequest.findOne({
            $or: [{
                "updateDoc.relatedProductId": updatedProduct.relatedProductId
            }, { "deleteDoc.relatedProductId": updatedProduct.relatedProductId }]
        }, { requestingDeo: 1 }).lean();

        if (existingRequest) {
            if (Object.keys(images).length !== 0) {
                _deleteUnReferencedImages(images);
            }

            response.statusCode = 409;
            response.message = "A request already exists on the product";
            return response;
        }

        if (Object.keys(images).length > 0) {
            updatedProduct["images"] = getDBFormatImages(images);
        }

        await ProductRequest.create({
            isUpdate: true,
            requestingDeo: mongoose.Types.ObjectId(token.id),
            updateDoc: updatedProduct
        });

        response.statusCode = 201;
        response.message = "Request Submitted";
        return response;

    } catch (err) {
        console.error(err);

        if (err instanceof SyntaxError) {
            response.statusCode = 400;
            response.message = "Invalid JSON";
        } else {
            response.statusCode = 500;
            response.message = "Error, try again";
            console.error(err);
        }
    }
}

async function addCreateProductRequest(productData, images, token) {
    const response = new GenericResponse();

    try {

        const validationResponse = validateCreateProductData(productData);
        if (validationResponse.statusCode !== 200) {
            _deleteUnReferencedImages(images);
            return validationResponse;
        }

        const product = validationResponse.responseData;

        const existingProduct = await Product.findOne({
            name: product.name
        }, { _id: 1 }).lean();

        if (existingProduct) {
            _deleteUnReferencedImages(images);

            response.statusCode = 409;
            response.message = `Product already exists`;
            return response;
        }

        const existingRequest = await ProductRequest.findOne({
            $or: [{
                "updateDoc.name": new RegExp(`^${product.name}$`, 'i')
            }, { "createDoc.name": new RegExp(`^${product.name}$`, 'i') }]

        }, { requestingDeo: 1 }).lean();

        if (existingRequest) {
            _deleteUnReferencedImages(images);

            response.statusCode = 409;
            response.message = `A request already exists on ${product.name}`;
            return response;
        }

        const existingMerchantPromise = Merchant.findById(product.relatedMerchant, {
            userId: 1
        }).lean();

        const existingCategoryPromise = Category.findById(product.relatedCategory, {
            _id: 1
        }).lean();

        const [existingMerchant, existingCategory] = await Promise.all([
            existingMerchantPromise,
            existingCategoryPromise
        ]);

        if (!existingMerchant) {
            response.statusCode = 404;
            response.message = "Merchant Not Found";
            return response;
        }

        if (!existingCategory) {
            response.statusCode = 404;
            response.message = "Category Not Found";
            return response;
        }

        product.images = getDBFormatImages(images);
        const newRequest = await ProductRequest.create({
            isCreate: true,
            createDoc: product,
            requestingDeo: mongoose.Types.ObjectId(token.id)
        });

        response.statusCode = 201;
        response.message = "Create Request Submitted";
        response.responseData = newRequest;
        return response;

    } catch (err) {
        console.error(err);

        _deleteUnReferencedImages(images);

        response.statusCode = 500;
        response.message = "Error, try again";
        return response;
    }
}

async function acceptProductRequest(requestId) {
    const response = new GenericResponse();
    const session = await mongoose.startSession();
    const notification = new Notification(messageState.ACCEPT);

    try {

        if (!mongoose.isValidObjectId(requestId)) {
            response.statusCode = 400;
            response.message = "Invalid ID";
            return response;
        } else {
            requestId = mongoose.Types.ObjectId(requestId);
        }

        const pendingRequest = await ProductRequest.findById(requestId)
            .populate("updateDoc.relatedProductId", ["images"])
            .populate("deleteDoc.relatedProductId", ["images"])
            .lean()
            .exec();

        if (!pendingRequest) {
            response.statusCode = 404;
            response.message = "No Request Found";
            return response;
        }

        notification.recieverId = pendingRequest.requestingDeo;

        session.startTransaction();

        await ProductRequest.findByIdAndDelete(requestId, {
            session: session
        });

        if (pendingRequest.isCreate) {
            notification.header = "Your CREATE request on Product was accepted!";

            await Product.create([pendingRequest.createDoc], {
                session: session
            });

        } else if (pendingRequest.isUpdate) {
            notification.header = "Your UPDATE request on Product was accepted!";

            pendingRequest.updateDoc.updatedOn = new Date();

            let imagesToDelete;

            //No images were updated
            if (!pendingRequest.updateDoc.images.thumb
                && pendingRequest.updateDoc.images.main.length === 0) {

                delete pendingRequest.updateDoc.images;
            }

            //Only thumb was updated
            if (pendingRequest.updateDoc.images.thumb
                && pendingRequest.updateDoc.images.main.length === 0) {

                pendingRequest.updateDoc.images = {
                    thumb: pendingRequest.updateDoc.images.thumb,
                    main: pendingRequest.updateDoc.relatedProductId.images.main
                };

                //Delete previous thumb image
                imagesToDelete = {
                    thumb: pendingRequest.updateDoc.relatedProductId.images.thumb
                };
            }

            //Only showcase images were updated
            if (!pendingRequest.updateDoc.images.thumb
                && pendingRequest.updateDoc.images.main.length > 0) {

                pendingRequest.updatedOn.images = {
                    thumb: pendingRequest.updateDoc.relatedProductId.images.thumb,
                    main: pendingRequest.updateDoc.images.main
                };

                //Delete previous main images
                imagesToDelete = {
                    main: pendingRequest.updateDoc.relatedProductId.images.main
                };
            }

            const productId = pendingRequest.updateDoc.relatedProductId._id;
            delete pendingRequest.updateDoc.relatedProductId;

            await Product.findByIdAndUpdate(productId, {
                $set: pendingRequest.updateDoc
            }, { session: session });

            if (imagesToDelete) {
                const result = await _deleteReferencedImages(imagesToDelete);
                if (result.Errors.length !== 0) {
                    throw new Error("S3 Objects delete failure");
                }
            }

        } else if (pendingRequest.isDelete) {
            notification.header = "Your DELETE request on Product was accepted!";

            const id = pendingRequest.deleteDoc.relatedProductId._id;
            const imagesToDelete = pendingRequest.deleteDoc.relatedProductId.images;

            await Product.findByIdAndDelete(id, { session: session });

            const s3Result = await _deleteReferencedImages(imagesToDelete);
            if (s3Result.Errors.length !== 0) {
                throw new Error("S3 Objects delete failure");
            }

        } else {
            throw new Error("Product pending request consists of invalid states");
        }

        await session.commitTransaction();

        sendNotification(notification);

        response.statusCode = 200;
        response.message = "Request Accepted";
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

async function createProduct(productData, images) {
    const response = new GenericResponse();
    const session = await mongoose.startSession();

    try {

        const validationResponse = validateCreateProductData(productData);
        if (validationResponse.statusCode !== 200) {
            _deleteUnReferencedImages(images);
            return validationResponse;
        }

        const product = validationResponse.responseData;

        const existingProduct = await Product.findOne({
            name: product.name
        }, { _id: 1 }).lean();

        if (existingProduct) {
            _deleteUnReferencedImages(images);

            response.statusCode = 409;
            response.message = "Product already exists";
            return response;
        }

        const existingMerchantPromise = Merchant.findById(product.relatedMerchant, {
            userId: 1
        }).lean();

        const existingCategoryPromise = Category.findById(product.relatedCategory, {
            _id: 1
        }).lean();

        const [existingMerchant, existingCategory] = await Promise.all([
            existingMerchantPromise,
            existingCategoryPromise
        ]);

        if (!existingMerchant) {
            response.statusCode = 404;
            response.message = "Merchant Not Found";
            return response;
        }

        if (!existingCategory) {
            response.statusCode = 404;
            response.message = "Category Not Found";
            return response;
        }

        product.images = getDBFormatImages(images);

        session.startTransaction();

        await Category.findOneAndUpdate({ _id: product.relatedCategory }, {
            $inc: { 'productCount': 1 },
        }, { session: session }).exec();

        await Product.create([product], { session: session });

        await session.commitTransaction();

        const notification = new Notification(
            messageState.INFO,
            "Product has been added",
            `${product.name} has been registered to your account and is now online!`,
            existingMerchant.userId
        );

        //Notify related Merchant on Product add
        sendNotification(notification);

        response.statusCode = 201;
        response.message = "Product Added";
        return response;

    } catch (err) {
        console.error(err);

        if (session.inTransaction) {
            await session.abortTransaction();
        }

        _deleteUnReferencedImages(images);

        response.statusCode = 500;
        response.message = "Error, try again";
        return response;

    } finally {
        await session.endSession();
    }
}

function getDBFormatImages(images) {
    const ddn = process.env.AWS_CLOUDFRONT_DDN + "/";
    let main;
    let thumb;

    if (images.thumb && images.thumb.length !== 0) {
        thumb = {
            url: ddn + images.thumb[0].key,
            mimeType: images.thumb[0].mimetype,
            size: images.thumb[0].size
        };
    }

    if (images.main) {
        main = images.main.map(img => {
            return {
                url: ddn + img.key,
                mimeType: img.mimetype,
                size: img.size
            };
        });
    }

    return {
        thumb: thumb,
        main: main
    };
}

function validateCreateProductData(data) {
    const response = new GenericResponse(400, "Invalid Fields");

    try {

        if (!data) {
            response.statusCode = 400;
            response.message = "Invalid Data";
            return response;
        }

        const parsedData = JSON.parse(data);

        if (!parsedData.relatedMerchant || !parsedData.relatedCategory
            || !parsedData.name || !parsedData.description
            || !parsedData.price || !parsedData.quantity) {

            return response;
        }

        parsedData.quantity = parseInt(parsedData.quantity);
        parsedData.price = parseInt(parsedData.price);
        parsedData["productCode"] = generateUniqueId();
        parsedData.name = validator.trim(parsedData.name);
        parsedData.description = validator.trim(parsedData.description);

        if (!parsedData.name || !parsedData.description) {
            return response;
        }

        if (isNaN(parsedData.quantity) ||
            parsedData.quantity < 0 ||
            parsedData.quantity >= Number.MAX_VALUE) {

            response.message = "Invalid Quantity";
            return response;
        }

        if (isNaN(parsedData.price) ||
            parsedData.price < 0 ||
            parsedData.price > Number.MAX_VALUE) {

            response.message = "Invalid Price";
            return response;
        }

        if (!mongoose.isValidObjectId(parsedData.relatedMerchant)
            || !mongoose.isValidObjectId(parsedData.relatedCategory)) {

            response.message = "Invalid IDs";
            return response;
        }

        parsedData.relatedMerchant = mongoose.Types.ObjectId(parsedData.relatedMerchant);
        parsedData.relatedCategory = mongoose.Types.ObjectId(parsedData.relatedCategory);

        response.statusCode = 200;
        response.responseData = parsedData;
        return response;

    } catch (err) {

        if (err instanceof SyntaxError) {
            response.statusCode = 400;
            response.message = err;
        } else {
            response.statusCode = 500;
            response.message = "Error, try again";
            console.error(err);
        }

        return response;
    }
}

async function _deleteReferencedImages(images) {
    const breakpoint = process.env.AWS_CLOUDFRONT_DDN + "/";
    const objects = [];

    if (!images) {
        throw new Error("No object passed as a parameter for S3 deletion");
    }

    if (images.thumb) {
        const key = images.thumb.url.split(breakpoint)[1];
        objects.push({ Key: key });
    }

    if (images.main) {
        images.main.forEach(img => {
            const key = img.url.split(breakpoint)[1];
            objects.push({ Key: key });
        });
    }

    return _s3ImageDelete(objects);
}

async function _deleteUnReferencedImages(images) {
    if (!images || !images.thumb && !images.main) {
        return Promise.reject("No references provided for images");
    }

    const objects = [];

    if (images.thumb) {
        objects.push({ Key: images.thumb[0].key });
    }

    if (images.main) {
        images.main.forEach(img => {
            objects.push({ Key: img.key });
        });
    }

    return _s3ImageDelete(objects);
}

async function _s3ImageDelete(objects) {
    const delParam = {
        Bucket: bucket,
        Delete: {
            Objects: objects
        }
    };

    return s3.deleteObjects(delParam).promise();
}

//Fix populate
async function getPendingProductRequests() {
    const response = new GenericResponse();

    try {

        const pendingRequests = await ProductRequest.find()
            .populate("requestingDeo", ["email", "firstName", "lastName"])
            .populate("createDoc.relatedMerchant", ["brand"])
            .populate("createDoc.relatedCategory", ["name", "productCount"])
            .populate("updateDoc.relatedProductId", ["name", "relatedMerchant", "relatedCategory"])
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

async function getMerchantUserProducts(merchantId) {
    const response = new GenericResponse();

    try {

        const products = await Product.find({
            relatedMerchant: merchantId
        }, {
            name: 1, price: 1,
            quantity: 1, rating: 1,
            "images.thumb.url": 1, addedOn: 1
        }).populate("relatedCategory", ["name"]).lean().exec();

        response.statusCode = 200;
        response.message = "Success";
        response.responseData = products;
        return response;

    } catch (err) {
        console.error(err);

        response.statusCode = 500;
        response.message = "Error, try again";
        return response;
    }
}

async function getProducts(query) {
    const response = new GenericResponse()

    try {
        let dbQuery;

        const limit = parseInt(query.lim);
        const offset = parseInt(query.off);

        if (isNaN(limit) || isNaN(offset) || limit <= 0 || offset < 0) {
            response.statusCode = 400;
            response.message = "Invalid query";
            return response;
        }

        if (query.cat.toUpperCase() === "ALL") {
            dbQuery = {
                "controls.isPublished": true
            }
        } else if (!mongoose.isValidObjectId(query.cat)) {

            response.statusCode = 400;
            response.message = "Invalid Category ID";
            return response;

        } else {
            query.cat = mongoose.Types.ObjectId(query.cat)
            dbQuery = {
                relatedCategory: query.cat,
                "controls.isPublished": true
            }
        }

        const result = await Product.paginate(dbQuery, {
            offset: offset,
            limit: limit,
            lean: true,
            select: "name price images.thumb.url controls.isDiscounted controls.discount rating.average"
        });

        response.statusCode = 200;
        response.message = "Success";
        response.responseData = {
            total: result.total,
            limit: result.limit,
            offset: result.offset,
            products: result.docs
        };

        return response;

    } catch (err) {
        console.error(err)

        response.statusCode = 500;
        response.message = "Error, try again";
        return response;
    }
}

async function getProduct(productId) {
    const response = new GenericResponse()

    try {

        if (!mongoose.isValidObjectId(productId)) {

            response.statusCode = 400;
            response.message = "Invalid Product ID";
            return response;

        } else {
            productId = mongoose.Types.ObjectId(productId)
        }

        const result = await Product.findById(productId, {
            _id: 1,
            name: 1,
            description: 1,
            productCode: 1,
            price: 1,
            quantity: 1,
            controls: 1,
            "images.main.url": 1,
            "rating.count": 1,
            "rating.average": 1
        }).populate("relatedMerchant", ["brand"]).lean()

        response.statusCode = 200;
        response.message = "Success";
        response.responseData = result;
        return response;

    } catch (err) {
        console.error(err)

        response.statusCode = 500;
        response.message = "Error, try again";
        return response;
    }
}

export {
    createProduct,
    acceptProductRequest,
    addCreateProductRequest,
    addDeleteProductRequest,
    addUpdateProductRequest,
    rejectProductRequest,
    getPendingProductRequests,
    getMerchantUserProducts,
    getProducts,
    getProduct
};
