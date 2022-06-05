import mongoose from "mongoose";
import validator from "validator";
import GenericResponse from "../helpers/dto/generic.response.js";
import userRole from "../helpers/user.roles.js";
import Management from "../models/Management.js";
import MerchantRequest from "../models/MerchantRequest.js";
import Suspend from "../models/Suspend.js";
import User from "../models/User.js";

async function suspendUser(suspendRequest) {
    const genericResponse = new GenericResponse();

    try {
        const suspendReason = suspendRequest.reason.trim();
        const userId = suspendRequest.userToSuspend;
        const adminId = suspendRequest.token.id;

        if (!mongoose.isValidObjectId(userId)) {
            genericResponse.statusCode = 400;
            genericResponse.message = "Invalid ID";
            return genericResponse;
        }

        const user = await User.findById(userId);
        if (!user) {
            genericResponse.statusCode = 404;
            genericResponse.message = "Invalid Account";
            return genericResponse;
        }

        if (user.id === adminId) {
            genericResponse.statusCode = 403;
            genericResponse.message = "Forbidden Action";
            return genericResponse;
        }

        const session = await mongoose.startSession();

        await session.withTransaction(async () => {
            const userId = mongoose.Types.ObjectId(userId);

            const suspend = await Suspend.create([{
                userId: userId,
                reason: suspendReason
            }], { session });

            await MerchantRequest.findOneAndRemove({
                requestedBy: userId
            }, { session: session });

            user.suspendId = suspend[0]._id;
            await user.save({ session });
        });

        await session.endSession();

        genericResponse.statusCode = 200;
        genericResponse.message = "Success";
        return genericResponse;

    } catch (err) {
        genericResponse.statusCode = 500;
        genericResponse.message = "Unexpected Error";
        return genericResponse;
    }
}

async function updateRole(updateRequest, token) {
    const genericResponse = new GenericResponse();

    try {

        if (!mongoose.isValidObjectId(updateRequest.userId)) {
            genericResponse.statusCode = 400;
            genericResponse.message = "Invalid ID";
            return genericResponse;
        }

        if (updateRequest.userId === token.id) {
            genericResponse.statusCode = 403;
            genericResponse.message = "Forbidden Action";
            return genericResponse;
        }

        updateRequest.role = validator.trim(updateRequest.role.toUpperCase());
        const systemRole = userRole[updateRequest.role];
        if (!systemRole) {
            genericResponse.statusCode = 400;
            genericResponse.message = "Invalid Role";
            return genericResponse;
        }

        if (systemRole === userRole.MERCHANT) {
            genericResponse.statusCode = 403;
            genericResponse.message = "Forbidden Merchant Creation";
            return genericResponse;
        }

        //MANAGER can not add ADMIN or SUPER ADMIN
        if (token.role === userRole.MANAGER) {
            if (updateRequest.role === userRole.ADMIN
                || updateRequest.role === userRole.SUPER_ADMIN) {

                genericResponse.statusCode = 403;
                genericResponse.message = "Forbidden Update Request";
                return genericResponse;
            }
        }

        const userId = mongoose.Types.ObjectId(updateRequest.userId);
        const user = await User.findById(userId);
        if (!user) {
            genericResponse.statusCode = 404;
            genericResponse.message = "Invalid User";
            return genericResponse;
        }

        //User has the same role
        if (user.role === updateRequest.role) {
            genericResponse.statusCode = 400;
            genericResponse.message = "Invalid Action";
            return genericResponse;
        }

        const session = await mongoose.startSession();
        await session.withTransaction(async () => {

            user.role = updateRequest.role;
            await user.save({ session });

            const existingManagementUser = await Management.findOne({ userId: userId }, null, {
                session: session
            });

            if (existingManagementUser) {
                if (updateRequest.role === userRole.CUSTOMER) {
                    await Management.findByIdAndDelete(existingManagementUser._id, { session });
                } else {
                    existingManagementUser.addedBy = mongoose.Types.ObjectId(token.id);
                    existingManagementUser.updatedOn = Date.now();
                    await existingManagementUser.save({ session });
                }
            } else {
                await Management.create([{
                    userId: userId,
                    addedBy: mongoose.Types.ObjectId(token.id),
                    role: systemRole //Safe keep the new role
                }], { session: session });
            }

        });
        await session.endSession();

        genericResponse.statusCode = 200;
        genericResponse.message = "Access Updated";
        return genericResponse;

    } catch (err) {
        console.error(err);

        genericResponse.statusCode = 500;
        genericResponse.message = "Unexpected Error";
        return genericResponse;
    }
}

export {
    suspendUser,
    updateRole
};
