/* eslint-disable no-undef */
import AWS from "aws-sdk";

const s3 = new AWS.S3({
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_ID,
        secretAccessKey: process.env.AWS_SECRET
    },
    region: process.env.AWS_S3_BUCKET_REGION
});

const bucket = process.env.AWS_S3_BUCKET_NAME;

export {
    s3,
    bucket
};