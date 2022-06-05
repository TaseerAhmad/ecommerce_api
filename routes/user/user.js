import express from "express";
import userRole from "../../helpers/user.roles.js";
import authenticate from "../../middleware/authentication.js";
import authorize from "../../middleware/authorization.js";
import * as service from "../../services/user.service.js";

const userRouter = express.Router();

userRouter.post("/suspend", authenticate,
  authorize([userRole.ADMIN]), async (req, res) => {

    try {

      if (!req.body.userId || !req.body.reason) {
        return res.status(400).send({
          message: "Invalid fields",
        });
      }

      const request = {
        userToSuspend: req.body.userId,
        reason: req.body.reason,
        token: req.token
      };

      const response = await service.suspendUser(request);
      return res.status(response.statusCode).json(response);

    } catch (err) {
      console.error(err);
    }

  });

//updateRole?userId=&role=
userRouter.post("/updateRole", authenticate,
  authorize([
    userRole.ADMIN,
    userRole.MANAGER,
    userRole.SUPER_ADMIN]), async (req, res) => {

      try {

        if (!req.query.userId || !req.query.role) {
          return res.status(400).send({
            message: "Invalid Parameters",
          });
        }

        const response = await service.updateRole(req.query, req.token);
        return res.status(response.statusCode).json(response);

      } catch (err) {
        console.error(err);
      }

    });

export default userRouter;