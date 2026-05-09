import mongoose from "mongoose";
const connectDB = async () => {
  const url = process.env.MONGO_URI;
  if (!url) {
    throw new Error("MONGO_URI is not found");
  }
  try {
    await mongoose.connect(url, {
      dbName: "ChatAppMicroservices",
    });
    console.log("Connected to mongoDB");
  } catch (error) {
    console.error("Failed to connect to mongoDB", error);
    process.exit(1);
  }
};

export default connectDB;
