import mongoose from "mongoose";
import validator from "validator";
import GenericResponse from "../helpers/dto/generic.response.js";
import Notification from "../helpers/dto/notification.js";
import generateUniqueId from "../helpers/id.generator.js";
import messageState from "../helpers/message.states.js";
import orderState from "../helpers/order.states.js";
import ActiveOrder from "../models/ActiveOrder.js";
import OrderHistory from "../models/OrderHistory.js";
import Product from "../models/Product.js";
import * as notificationService from "../services/notification.service.js";
import * as stockService from "../services/stock.service.js";

async function placeOrder(customerOrder, token) {
    const response = new GenericResponse();
    const session = await mongoose.startSession();

    try {

        let hasInvalidId = false
        customerOrder.order.forEach(item => {
            if (!mongoose.isValidObjectId(item.productId)) {
                hasInvalidId = true
            } else {
                item.productId = mongoose.Types.ObjectId(item.productId)
            }
        });

        if (hasInvalidId) {
            response.statusCode = 400;
            response.message = "Invalid ID";
            return response;
        }

        if (customerOrder.order.length >= 10) {
            response.statusCode = 400;
            response.message = "Order quantity exceeds allowed limit";
            return response;
        }

        session.startTransaction();

        const updateJobs = [];
        customerOrder.order.forEach(async (order) => {
            const updatePromise = Product.updateOne({
                _id: order.productId
            }, {
                $inc: {
                    quantity: -Math.abs(order.quantity)
                }
            }, { session: session });

            updateJobs.push(updatePromise)
        });
        await Promise.all(updateJobs)

        const orderID = generateUniqueId(12)

        await ActiveOrder.create([{
            relatedUser: mongoose.Types.ObjectId(token.id),
            orderItems: customerOrder.order,
            shippingAddress: customerOrder.shippingAddress,
            orderId: orderID,
            orderState: {
                current: orderState.VERFYING,
                verifyTime: Date.now()
            }
        }], { session: session });

        await session.commitTransaction();


        const notification = new Notification(messageState.INFO, "Order", `Your order has been placed!\n Order: #${orderID}`, mongoose.Types.ObjectId(token.id))
        notificationService.sendNotification(notification);

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

        const activeOrder = await ActiveOrder.findById(ticketId).lean();

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

                const msg = `Your order has been verified. Currently being processed.\n Order: #${activeOrder.orderId}`;
                const notification = new Notification(messageState.ACCEPT, "Order", msg, mongoose.Types.ObjectId(activeOrder.relatedUser))
                notificationService.sendNotification(notification);

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


                let msg = `Your order has failed due to some reason.\n Order: #${activeOrder.orderId}`;
                if (newTicketState === orderState.CANCELED) {
                    type = "cancelled";
                    msg = `Your order has been cancelled.\n Order: #${activeOrder.orderId}`;
                }

                const notification = new Notification(messageState.REJECT, "Order", msg, mongoose.Types.ObjectId(activeOrder.relatedUser))
                notificationService.sendNotification(notification);

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

                const msg = `Your order has been dispatched.\n Order: #${activeOrder.orderId}`;
                const notification = new Notification(messageState.ACCEPT, "Order", msg, mongoose.Types.ObjectId(activeOrder.relatedUser))
                notificationService.sendNotification(notification);

                //notifyRelatedEntitiesOnStock(activeOrder); //FIX QUANTITY

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

                const msg = `Your order has failed.\n Order: #${activeOrder.orderId}`;
                const notification = new Notification(messageState.INFO, "Order", msg, mongoose.Types.ObjectId(activeOrder.relatedUser))
                notificationService.sendNotification(notification);

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

            const msg = `Your order has been delivered. Enjoy!\n Order: #${activeOrder.orderId}`;
            const notification = new Notification(messageState.ACCEPT, "Order", msg, mongoose.Types.ObjectId(activeOrder.relatedUser))
            notificationService.sendNotification(notification);

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

        if (ticketState === orderState.ALL) {
            const orders = await ActiveOrder.find()
            .populate("relatedUser", ["email", "firstName"])
            .populate("shippingAddress", ["contact", "city", "address"])
            .populate("orderItems.productId", ["name"])
            .lean();
            
            response.statusCode = 200;
            response.message = "Success";
            response.responseData = orders;
            return response;
        }

        const orders = await ActiveOrder.find({ "orderState.current": ticketState })
            .populate("relatedUser", ["email", "firstName"])
            .populate("shippingAddress", ["contact", "city", "address"])
            .populate("orderItems.productId", ["name"]);

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

async function getOrderRecords(token, recordType) {
    const response = new GenericResponse();

    try {
        const userId = mongoose.Types.ObjectId(token.id);
        recordType = recordType.trim().toUpperCase();

        if (recordType !== "CURR" && recordType !== "PAST") {
            response.statusCode = 400;
            response.message = "Invalid Record Type";
            return response;
        }

        if (recordType === "CURR") {

            const activeOrders = await ActiveOrder.find({ relatedUser: userId })
                .populate("orderItems.productId", ["name", "productCode"])
                .lean()
                .exec();

            response.statusCode = 200;
            response.message = "Success";
            response.responseData = activeOrders;
            return response;

        } else {

            const pastOrders = await OrderHistory.find({ relatedUser: userId })
                .populate("orderItems.productId", ["name", "productCode"])
                .lean()
                .exec();

            response.statusCode = 200;
            response.message = "Success";
            response.responseData = pastOrders;
            return response;
        }

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
    const revertJobs = [];
    activeOrder.orderItems.forEach(item => {
        const job = Product.findByIdAndUpdate(item.productId, {
            $inc: { quantity: item.quantity }
        }, { session: session });

        revertJobs.push(job);
    });
    await Promise.all(revertJobs);
    // await Product.findByIdAndUpdate(activeOrder.relatedProduct._id, {
    //     $inc: { quantity: activeOrder.quantity }
    // }, { session: session });
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
        orderItems: activeOrder.orderItems,
        orderId: activeOrder.orderId,
        orderedOn: activeOrder.orderedOn,
        shippingAddress: activeOrder.shippingAddress,
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
    getPendingOrderTickets,
    getOrderRecords
};

