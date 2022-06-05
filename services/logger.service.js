import { getErrorLogMailOptions, systemLogger } from "../config/logger.config.js";
import chalk from "chalk";

function sendErrorLog(errorLog) {
    if (!errorLog || Object.keys(errorLog).length === 0) {
        console.log(chalk.bold(chalk.yellowBright("SYSLOG: Error Skipped!")));
        return;
    }

    systemLogger.sendMail(getErrorLogMailOptions(errorLog), (err) => {
        if (err) {
            console.error(err);
        } else {
            console.log(chalk.bold(chalk.greenBright("SYSLOG: Error captured, report delivered!")));
        }
    });
}

export default sendErrorLog;