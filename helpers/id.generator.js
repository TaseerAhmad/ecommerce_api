/* eslint-disable no-undef */
import { customAlphabet } from "nanoid";

function generateUniqueId(length) {
    const dictionary = process.env.S3_IMG_DICTIONARY;
    let size = parseInt(process.env.S3_IMG_KEY_SIZE);

    if (isNaN(size)) {
        throw new Error("Length is not of type Number");
    }

    if (length) {
        size = parseInt(length);
        if (isNaN(size)) {
            throw new Error("Length is not of type Number");
        }
    }

    const id = customAlphabet(dictionary, size);
    return id();
}

export default generateUniqueId;