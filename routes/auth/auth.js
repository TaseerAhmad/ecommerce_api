import express from "express";
import * as service from "../../services/auth.service.js";
const authRoute = express.Router();

authRoute.post("/register", verifyRegisterBody, async (req, res) => {
  try {
    const response = await service.registerUser(req.body);
    return res.status(response.statusCode).json(response);
  } catch (err) {
    console.error(err);

    return res.sendStatus(500);
  }
});

authRoute.post("/login", verifyLoginBody, async (req, res) => {
  try {
    const response = await service.loginUser(req.body);
    return res.status(response.statusCode).json(response);
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }
});

function verifyRegisterBody(req, res, next) {
  if (
    !req.body.email ||
    !req.body.firstName ||
    !req.body.lastName ||
    !req.body.password ||
    !req.body.confirmPassword
  ) {
    return res.status(400).send({
      message: "Invalid fields",
    });
  }

  next();
}

function verifyLoginBody(req, res, next) {
  if (!req.body.email || !req.body.password) {
    return res.status(400).send({
      message: "Invalid fields",
    });
  }

  next();
}

export default authRoute;
