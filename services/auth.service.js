/* eslint-disable no-undef */
import * as bcrypt from "bcrypt";
import * as EmailValidator from "email-validator";
import jwt from "jsonwebtoken";
import GenericResponse from "../helpers/dto/generic.response.js";
import User from "../models/User.js";

async function registerUser(user) {
  const response = new GenericResponse();

  try {

    const existingUser = await User.findOne({
      email: user.email,
    });

    if (existingUser) {
      response.statusCode = 409;
      response.message = "User already exists";
      return response;
    }

    const sanitizedUser = {
      email: user.email.trim(),
      lastName: user.lastName.trim(),
      firstName: user.firstName.trim(),
      password: user.password.trim(),
      confirmPassword: user.confirmPassword.trim(),
    };

    const isEmailValid = EmailValidator.validate(user.email);
    if (!isEmailValid) {
      response.statusCode = 400;
      response.message = "Invalid Email";

      return response;
    }

    if (sanitizedUser.password.length < 6) {
      response.statusCode = 400;
      response.message = "Password too short";

      return response;
    }

    if (sanitizedUser.password !== sanitizedUser.confirmPassword) {
      response.statusCode = 400;
      response.message = "Passwords do not match";

      return response;
    }

    if (!sanitizedUser.firstName || !sanitizedUser.lastName) {
      response.statusCode = 400;
      response.message = "Invalid Name";

      return response;
    }

    const hashedPassword = await bcrypt.hash(user.password, 14);
    sanitizedUser.password = hashedPassword;

    const newUser = await User.create(sanitizedUser);

    const token = getSignedToken(
      newUser.id,
      newUser.role,
      newUser.email
    );

    response.statusCode = 201;
    response.message = "Success";
    response.responseData = {
      jwt: token,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      merchantId: newUser.merchantId,
    };

    return response;

  } catch (err) {
    console.error(err);
    response.statusCode = 500;
    response.message = "Error, try again later";

    return response;
  }
}

async function loginUser(user) {
  const response = new GenericResponse();

  try {
    
    const sanitizedUser = {
      email: user.email.trim(),
      password: user.password.trim(),
    };

    const isEmailValid = EmailValidator.validate(sanitizedUser.email);
    if (!isEmailValid) {
      response.statusCode = 400;
      response.message = "Invalid Email";

      return response;
    }

    const existingUser = await User.findOne({
      email: sanitizedUser.email,
    });

    if (!existingUser) {
      response.statusCode = 404;
      response.message = "Invalid Account";

      return response;
    }

    const isPasswordValid = await bcrypt.compare(
      sanitizedUser.password,
      existingUser.password
    );
    if (!isPasswordValid) {
      response.statusCode = 403;
      response.message = "Invalid Password";

      return response;
    }

    if (existingUser.suspendedAt) {
      response.statusCode = 403;
      response.message = "Account Suspended";

      return response;
    }

    const token = getSignedToken(
      existingUser.id,
      existingUser.role,
      existingUser.email
    );

    response.statusCode = 200;
    response.message = "Success";
    response.responseData = {
      jwt: token,
      email: existingUser.email,
      role: existingUser.role,
      firstName: existingUser.firstName,
      lastName: existingUser.lastName,
      merchantId: existingUser.merchantId,
      createdAt: existingUser.createdAt,
    };

    return response;

  } catch (err) {
    console.error(err);

    response.statusCode = 500;
    response.message = "Error, try again later";

    return response;
  }
}

function getSignedToken(id, role, email) {
  const token = jwt.sign(
    {
      id: id,
      role: role,
      email: email,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "30d",
    }
  );

  return `Bearer ${token}`
}

export { registerUser, loginUser };
