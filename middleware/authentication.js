/* eslint-disable no-undef */
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/User.js";

function auth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(400).json({
      statusCode: 400,
      message: "MISSING_AUTH_HEADER",
    });
  }

  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      switch (err.name) {
        case "TokenExpiredError":
          return res.status(403).json({
            statusCode: 403,
            message: err.message.toUpperCase(),
          });
        case "JsonWebTokenError":
          return res.status(403).json({
            statusCode: 403,
            message: err.message.toUpperCase(),
          });
        default:
          return res.status(403).json({
            statusCode: 403,
            message: "Unauthorized request",
          });
      }
    }

    const userId = mongoose.Types.ObjectId(decoded.id);
    User.findById(userId).then((result) => {
      if (!result) {
        return res.status(500).json({
          statusCode: 403,
          message: "Invalid User",
        });
      }

      if (result.role !== decoded.role) {
        return res.status(401).json({
          statusCode: 401,
          message: "Logged Out",
        });
      }

      if (result.suspendId) {
        return res.status(403).json({
          statusCode: 403,
          message: "Account Suspended",
        });
      } else {
        req.token = decoded;
        next();
      }
    }).catch((error) => {
      console.error(error);
      return res.status(500).json({
        statusCode: 500,
        message: "Authentication Error",
      });
    });
  });
}

export default auth;
