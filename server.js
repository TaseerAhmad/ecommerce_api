import chalk from "chalk";
import "dotenv/config";
import express from "express";
import userAgent from "express-useragent";
import helmet from "helmet";
import connectDatabase from "./config/db.config.js";
import { globalRateLimiter } from "./config/ratelimiter.config.js";
import appRoutes from "./routes/index.js";
import morgan from "morgan"

const app = express();
app.use(helmet());
app.use(express.json());
app.use(userAgent.express());
app.use(globalRateLimiter);
app.use(morgan("tiny"));
app.use(appRoutes);

connectDatabase();
const port = process.env.PORT || 5000

const server = app.listen(port, () => {
  console.log(chalk.greenBright("\n[SERVER] Server started at PORT 5000\n"));
});

server.keepAliveTimeout = 30000