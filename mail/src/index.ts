import express from "express";
import dotenv from "dotenv";
import { startSentOtpConsumer } from "./consumer.js";
dotenv.config();
startSentOtpConsumer();
const app = express();
app.listen(process.env.PORT, () => {
  console.log(`Server is running on port ${process.env.PORT}`);
});
