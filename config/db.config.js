/* eslint-disable no-undef */
import chalk from "chalk";
import mongoose from "mongoose";

async function connectDatabase() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log(chalk.greenBright("[DATABASE] MongoDB connected!\n"));
  } catch (err) {
    console.error(chalk.redBright(err));
  }
}

export default connectDatabase;
