import amqp from "amqplib";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();
export const startSentOtpConsumer = async () => {
  try {
    const connection = await amqp.connect({
      protocol: "amqp",
      hostname: process.env.Rabbitmq_HOST,
      port: 5672,
      username: process.env.Rabbitmq_Username,
      password: process.env.Rabbitmq_Password,
    });
    const channel = await connection.createChannel();
    const queueName = "send-otp";
    await channel.assertQueue(queueName, { durable: true });
    console.log("✅ Mail service consumer started, listening for otp emails");
    channel.consume(queueName, async (msg) => {
      try {
        if (!msg) {
          console.log("there is no msg in queue");
          return;
        }
        const { to, subject, body } = JSON.parse(msg.content.toString());
        const transporter = nodemailer.createTransport({
          host: "smtp.gmail.com",
          port: 465,
          auth: {
            user: process.env.USER,
            pass: process.env.PASSWORD,
          },
          tls: {
            rejectUnauthorized: false,
          },
        });
        await transporter.sendMail({
          from: "ChattApp <no-reply@chattapp.com>",
          to,
          subject,
          text: body,
        });
        console.log(`OTP sent to ${to}`);
        channel.ack(msg);
      } catch (error) {
        console.log("failed to send OTP ", error);
      }
    });
  } catch (error) {
    console.log("failed to start rabbitmq consumer ", error);
  }
};
