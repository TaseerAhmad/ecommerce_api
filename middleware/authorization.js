import GenericResponse from "../helpers/dto/generic.response.js";

function authorize(allowedRoles) {
  return function (req, res, next) {
    const genericResponse = new GenericResponse();

    if (!req.token) {
      genericResponse.statusCode = 500;
      genericResponse.message = "Unexpected Error";

      return res.status(genericResponse.statusCode).json(genericResponse);
    }

    const userRole = req.token.role;
    const isAllowed = allowedRoles.find(
      (allowedRole) => allowedRole === userRole
    );



    if (!isAllowed) {
      genericResponse.statusCode = 403;
      genericResponse.message = "Unauthorized request";

      return res.status(genericResponse.statusCode).json(genericResponse);
    } else {
      //Serve the request
      next();
    }
  };
}

export default authorize;
