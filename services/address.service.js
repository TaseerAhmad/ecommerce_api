import mongoose from "mongoose";
import validator from "validator";
import GenericResponse from "../helpers/dto/generic.response.js";
import Address from "../models/Address.js";
import User from "../models/User.js";

async function addAddress(newAddress, token) {
    const response = new GenericResponse();

    try {

        const trimmedContact = validator.trim(newAddress.contact);
        const isValidPhone = validator.isMobilePhone(trimmedContact, "en-PK");
        if (!isValidPhone) {
            response.statusCode = 400;
            response.message = "Invalid Phone";
            return response;
        }

        const trimmedCity = validator.trim(newAddress.city);
        const isInvalidCity = validator.isEmpty(trimmedCity);
        if (isInvalidCity) {
            response.statusCode = 400;
            response.message = "Invalid City";
            return response;
        }

        const trimmedAddress = validator.trim(newAddress.address);
        const isInvalidAddress = validator.isEmpty(trimmedAddress);
        if (isInvalidAddress) {
            response.statusCode = 400;
            response.message = "Invalid Address";
            return response;
        }

        const userId = mongoose.Types.ObjectId(token.id);
        const user = await User.findById(userId);
        if (user.savedDeliveryAddresses === 5) {
            response.statusCode = 422;
            response.message = "Address limit reached";
            return response;
        }

        const sanitized = {
            userId: userId,
            city: trimmedCity,
            contact: trimmedContact,
            address: trimmedAddress
        };

        const session = await mongoose.startSession();
        await session.withTransaction(async () => {

            await Address.create([sanitized], { session });
            const user = await User.findById(userId, {
                savedDeliveryAddresses: 1
            }, { session });

            user.savedDeliveryAddresses++;
            await user.save({ session });

        });
        await session.endSession();

        response.statusCode = 201;
        response.message = "Success";
        return response;

    } catch (err) {
        console.error(err);

        response.statusCode = 500;
        response.message = "Error, try again";
        return response;
    }
}

async function getAddress(token) {
    const response = new GenericResponse();

    try {

        const userId = mongoose.Types.ObjectId(token.id);
        const addresses = await Address.find({ userId: userId }, {
            __v: 0,
            userId: 0
        }).lean().exec();

        response.statusCode = 200;
        response.message = "Success",
            response.responseData = addresses;
        return response;

    } catch (err) {
        console.error(err);

        response.statusCode = 500;
        response.message = "Error, try again";
        return response;
    }

}

async function updateAddress(updatedAddress) {
    const response = new GenericResponse();

    try {

        if (Object.keys(updatedAddress).length < 2) {
            response.statusCode = 200;
            response.message = "Nothing to update";
            return response;
        }

        if (!mongoose.isValidObjectId(updatedAddress.id)) {
            response.statusCode = 400;
            response.message = "Invalid ID";
            return response;
        }

        if (updatedAddress.contact) {
            const trimmedContact = validator.trim(updatedAddress.contact);
            const isValiContact = validator.isMobilePhone(trimmedContact, "en-PK");
            if (!isValiContact) {
                response.statusCode = 400;
                response.message = "Invalid Phone";
                return response;
            }

            updatedAddress.contact = trimmedContact;
        }

        if (updatedAddress.city) {
            const trimmedCity = validator.trim(updatedAddress.city);
            const isInvalidCity = validator.isEmpty(trimmedCity);
            if (isInvalidCity) {
                response.statusCode = 400;
                response.message = "Invalid City";
                return response;
            }

            updatedAddress.city = trimmedCity;
        }

        if (updatedAddress.address) {
            const trimmedAddress = validator.trim(updatedAddress.address);
            const isInvalidAddress = validator.isEmpty(trimmedAddress);
            if (isInvalidAddress) {
                response.statusCode = 400;
                response.message = "Invalid Address";
                return response;
            }

            updatedAddress.address = trimmedAddress;
        }

        const addressId = mongoose.Types.ObjectId(updatedAddress.id);
        const updated = await Address.findByIdAndUpdate(addressId, {
            $set: updatedAddress
        }, { new: true }).lean();

        if (!updated) {
            response.statusCode = 404;
            response.message = "No Address Found";
            return response;
        }

        response.statusCode = 200;
        response.message = "Address Updated";
        return response;

    } catch (err) {
        console.error(err);

        response.statusCode = 500;
        response.message = "Error, try again";
        return response;
    }

}

async function deleteAddress(addressId, token) {
    const response = new GenericResponse();

    try {

        if (!mongoose.isValidObjectId(addressId)) {
            response.statusCode = 400;
            response.message = "Invalid ID";
            return response;
        }

        addressId = mongoose.Types.ObjectId(addressId);

        const address = await Address.findById(addressId).lean();
        if (!address) {
            response.statusCode = 404;
            response.message = "No Address Found";
            return response;
        }

        const session = await mongoose.startSession();
        await session.withTransaction(async () => {

            await Address.findByIdAndDelete(addressId, { session });
    
            const userId = mongoose.Types.ObjectId(token.id);
            const user = await User.findById(userId, null, { session });
            user.savedDeliveryAddresses--;
            await user.save({ session });

        });
        await session.endSession();

        response.statusCode = 200;
        response.message = "Address Deleted";
        return response;

    } catch (err) {
        console.error(err);

        response.statusCode = 500;
        response.message = "Error, try again";
        return response;
    }
}

export {
    getAddress,
    addAddress,
    updateAddress,
    deleteAddress
};
