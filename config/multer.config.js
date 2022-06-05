/* eslint-disable no-undef */
import multer from "multer";
import multerS3 from "multer-s3";
import generateUniqueId from "../helpers/id.generator.js";
import { s3, bucket } from "./aws.config.js";

const upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: bucket,
        metadata: function (req, file, cb) {
            cb(null, { fieldName: file.fieldname });
        },
        key: function (req, file, cb) {
            cb(null, generateUniqueId(32) + "." + file.mimetype.split("/")[1]);
        }
    }),
    fileFilter: function (req, file, cb) {
        const fileSize = parseInt(req.headers["content-length"]);

        if ((file.mimetype != "image/png" &&
            file.mimetype != "image/jpg" &&
            file.mimetype != "image/jpeg")) {
            cb("UNSUPPORTED_MEDIA_TYPE", false);
        } else if (isNaN(fileSize)) {
            cb("CONTENT_LENGTH_ERR", false);
        } else if (fileSize > process.env.FILE_SIZE_LIMIT) {
            cb("MEDIA_SIZE_REACHED", false);
        } else {
            cb(null, true);
        }

    }
});

export default upload;