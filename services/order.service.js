import mongoose from "mongoose";
import validator from "validator";
import GenericResponse from "../helpers/dto/generic.response.js";
import generateUniqueId from "../helpers/id.generator.js";
import orderState from "../helpers/order.states.js";
import ActiveOrder from "../models/ActiveOrder.js";
import Address from "../models/Address.js";
import OrderHistory from "../models/OrderHistory.js";
import Product from "../models/Product.js";
import * as stockService from "../services/stock.service.js";

async function placeOrder(order, token) {
    const response = new GenericResponse();
    const session = await mongoose.startSession();

    try {

        if (!mongoose.isValidObjectId(order.productId) &&
            !mongoose.isValidObjectId(order.addressId)) {

            response.statusCode = 400;
            response.message = "Invalid ID";
            return response;
        } else {
            order.productId = mongoose.Types.ObjectId(order.productId);
            order.addressId = mongoose.Types.ObjectId(order.addressId);
        }

        const orderQuantity = parseInt(order.quantity);

        if (isNaN(orderQuantity) || orderQuantity <= 0 || orderQuantity >= Number.MAX_VALUE) {
            response.statusCode = 400;
            response.message = "Invalid Quantity Format";
            return response;
        }

        //Enforce MAX limit on quantity
        if (orderQuantity >= 10) {
            response.statusCode = 400;
            response.message = "Order quantity exceeds allowed limit";
            return response;
        }

        const product = await Product.findById(order.productId, {
            quantity: 1, _id: 0, relatedMerchant: 1
        }, { session: session }).lean();

        //Check product validity
        if (!product) {
            response.statusCode = 404;
            response.message = "Invalid Product";
            return response;
        }

        //Check stock quantity
        if (product.quantity === 0) {
            response.statusCode = 422;
            response.message = "Out Of Stock";
            return response;
        }

        //Check order quantity
        if (orderQuantity > product.quantity) {
            response.statusCode = 400;
            response.message = "Invalid Quantity";
            return response;
        }

        const shippingAddress = await Address.findById(order.addressId, { _id: 1, }).lean();

        if (!shippingAddress) {
            response.statusCode = 404;
            response.message = "No Address Found";
            return response;
        }

        session.startTransaction();

        //Reduce stock
        await Product.updateOne({
            _id: order.productId
        }, {
            quantity: product.quantity - orderQuantity
        }, { session: session });

        //Create order ticket
        await ActiveOrder.create([{
            relatedUser: mongoose.Types.ObjectId(token.id),
            relatedProduct: order.productId,
            shippingAddress: shippingAddress._id,
            orderId: generateUniqueId(12),
            quantity: orderQuantity,
            orderState: {
                current: orderState.VERFYING,
                verifyTime: Date.now()
            }
        }], { session: session });

        await session.commitTransaction();

        response.statusCode = 201;
        response.message = "Order Placed";
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

async function cancelOrder(orderId) {
    const response = new GenericResponse();
    const session = await mongoose.startSession();

    try {

        if (!mongoose.isValidObjectId(orderId)) {
            response.statusCode = 400;
            response.message = "Invalid Order ID";
            return response;
        } else {
            orderId = mongoose.Types.ObjectId(orderId);
        }

        const activeOrder = await ActiveOrder.findById(orderId)
            .populate("relatedProduct", [
                "name", "price", "images.thumb.url", "quantity", "relatedMerchant", "productCode"
            ]).lean();

        if (!activeOrder) {
            response.statusCode = 404;
            response.message = "No Active Order Found";
            return response;
        }

        if (activeOrder.orderState.current !== orderState.VERFYING) {
            response.statusCode = 400;
            response.message = "Cancellation Not Allowed";
            return response;
        }

        session.startTransaction();

        await _revertProductQuantity(activeOrder, session);
        await ActiveOrder.findByIdAndDelete(activeOrder._id, { session: session });
        await OrderHistory.create([_buildOrderHistoryObj(orderState.CANCELED, activeOrder)], { session: session });

        await session.commitTransaction();

        response.statusCode = 200;
        response.message = "Order Cancelled";
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

async function updateOrderState(ticketId, newTicketState) {
    let response = new GenericResponse();
    const session = await mongoose.startSession();

    try {

        if (!mongoose.isValidObjectId(ticketId)) {
            response.statusCode = 400;
            response.message = "Invalid Ticket ID";
            return response;
        } else {
            ticketId = mongoose.Types.ObjectId(ticketId);
        }

        newTicketState = validator.trim(newTicketState).toUpperCase();

        if (!newTicketState || !Object.values(orderState).includes(newTicketState)) {
            response.statusCode = 400;
            response.message = "Invalid Ticket State";
            return response;
        }

        const activeOrder = await ActiveOrder.findById(ticketId)
            .populate("relatedProduct", [
                "name", "price", "images.thumb.url", "quantity", "relatedMerchant", "productCode"
            ]).lean();

        if (!activeOrder) {
            response.statusCode = 404;
            response.message = "No Active Order Found";
            return response;
        }

        const currentTicketState = activeOrder.orderState.current;

        if (currentTicketState === newTicketState) {
            response.statusCode = 200;
            response.message = "Nothing To Update";
            return response;
        }

        if (currentTicketState === orderState.VERFYING) {
            if (newTicketState !== orderState.PROCESSING &&
                newTicketState !== orderState.CANCELED &&
                newTicketState !== orderState.FAILED) {

                response.statusCode = 400;
                response.message = "Illegal Action";
                return response;
            }

            if (newTicketState === orderState.PROCESSING) {
                activeOrder.orderState.current = orderState.PROCESSING;
                activeOrder.orderState["processTime"] = Date.now();

                //Updated VERIFY --> PROCESSING
                await ActiveOrder.findOneAndUpdate({ _id: activeOrder._id }, activeOrder);

                response.statusCode = 200;
                response.message = "Ticket status updated to PROCESSING";
                return response;
            }

            if (newTicketState === orderState.CANCELED || newTicketState === orderState.FAILED) {
                session.startTransaction();

                await _revertProductQuantity(activeOrder, session);

                response = await _handleOrderCancelOrFailCase(
                    session,
                    newTicketState,
                    ticketId,
                    activeOrder,
                    response);

                await session.commitTransaction();

                return response;
            }
        }

        if (currentTicketState === orderState.PROCESSING) {
            if (newTicketState !== orderState.TRANSIT &&
                newTicketState !== orderState.CANCELED &&
                newTicketState !== orderState.FAILED) {

                response.statusCode = 400;
                response.message = "Illegal Action";
                return response;
            }

            if (newTicketState === orderState.TRANSIT) {
                activeOrder.orderState.current = orderState.TRANSIT;
                activeOrder.orderState["transitTime"] = Date.now();

                //Updated PROCESSING --> TRANSIT
                await ActiveOrder.findOneAndUpdate({ _id: activeOrder._id }, activeOrder);

                notifyRelatedEntitiesOnStock(activeOrder);

                response.statusCode = 200;
                response.message = "Ticket status updated to TRANSIT";
                return response;
            }

            if (newTicketState === orderState.CANCELED || newTicketState === orderState.FAILED) {
                session.startTransaction();

                await _revertProductQuantity(activeOrder, session);

                response = await _handleOrderCancelOrFailCase(
                    session,
                    newTicketState,
                    ticketId,
                    activeOrder,
                    response);

                await session.commitTransaction();

                return response;
            }
        }

        if (currentTicketState === orderState.TRANSIT) {
            if (newTicketState !== orderState.COMPLETED) {
                response.statusCode = 400;
                response.message = "Illegal Action";
                return response;
            }

            session.startTransaction();

            await ActiveOrder.findByIdAndDelete(activeOrder._id, { session: session });
            await OrderHistory.create([_buildOrderHistoryObj(newTicketState, activeOrder)], { session: session });

            await session.commitTransaction();

            response.statusCode = 200;
            response.message = "Order Completed";
            return response;
        }

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

async function getPendingOrderTickets(ticketState) {
    const response = new GenericResponse();

    try {

        ticketState = validator.trim(ticketState).toUpperCase();

        if (!ticketState || !Object.values(orderState).includes(ticketState)) {
            response.statusCode = 400;
            response.message = "Invalid Ticket State";
            return response;
        }

        const orders = await ActiveOrder.find({ "orderState.current": ticketState })
            .populate("relatedUser", ["email", "firstName"])
            .populate("shippingAddress", ["contact", "city", "address"])
            .populate("relatedProduct", ["name"]);

        response.statusCode = 200;
        response.message = "Success";
        response.responseData = orders;

        return response;

    } catch (err) {
        console.error(err);

        response.statusCode = 500;
        response.message = "Error, try again";
        return response;
    }
}

async function getTicketStates() {
    const response = new GenericResponse();

    try {

        response.statusCode = 200;
        response.message = "Success";
        response.responseData = orderState;

        return response;

    } catch (err) {
        console.error(err);

        response.statusCode = 500;
        response.message = "Error, try again";
        return response;
    }
}

async function notifyRelatedEntitiesOnStock(order) {
    if (order.relatedProduct.quantity === 0) {
        const product = order.relatedProduct;
        const merchantId = order.relatedProduct.relatedMerchant;

        stockService.sendStockEmptyAlertToManagers(product);
        stockService.sendStockEmptyAlertToMerchant(product, merchantId);
    }
}

async function _revertProductQuantity(activeOrder, session) {
    await Product.findByIdAndUpdate(activeOrder.relatedProduct._id, {
        $inc: { quantity: activeOrder.quantity }
    }, { session: session });
}

async function _handleOrderCancelOrFailCase(session, newTicketState, ticketId, activeOrder, response) {

    await OrderHistory.create([_buildOrderHistoryObj(newTicketState, activeOrder)], { session: session });

    await ActiveOrder.findByIdAndDelete(ticketId, { session: session });

    let newState;
    if (newTicketState === orderState.CANCELED) {
        newState = "CANCELLED";
    } else if (newTicketState === orderState.FAILED) {
        newState = "FAILED";
    }

    response.statusCode = 200;
    response.message = "Ticket status updated to " + newState;
    return response;
}

function _buildOrderHistoryObj(ticketState, activeOrder) {
    return {
        relatedUser: activeOrder.relatedUser,
        relatedProduct: activeOrder.relatedProduct,
        orderId: activeOrder.orderId,
        name: activeOrder.relatedProduct.name,
        price: activeOrder.relatedProduct.price,
        quantity: activeOrder.quantity,
        orderedOn: activeOrder.orderedOn,
        thumbImage: activeOrder.relatedProduct.images.thumb.url,
        orderState: _getOrderStateObj(ticketState, activeOrder)
    };
}

function _getOrderStateObj(ticketState, activeOrder) {
    if (ticketState === orderState.COMPLETED) {
        return {
            current: ticketState,
            verifyTime: activeOrder.orderState.verifyTime,
            processTime: activeOrder.orderState.processTime,
            transitTime: activeOrder.orderState.transitTime,
            completeTime: Date.now()
        };
    }

    if (ticketState === orderState.CANCELED) {
        return {
            current: ticketState,
            verifyTime: activeOrder.orderState.verifyTime,
            processTime: activeOrder.orderState.processTime,
            cancelTime: Date.now()
        };
    }

    if (ticketState === orderState.FAILED) {
        return {
            current: ticketState,
            verifyTime: activeOrder.orderState.verifyTime,
            processTime: activeOrder.orderState.processTime,
            failTime: Date.now()
        };
    }
}

export {
    placeOrder,
    cancelOrder,
    getTicketStates,
    updateOrderState,
    getPendingOrderTickets
};
