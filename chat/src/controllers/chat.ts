import axios from "axios";
import TryCatch from "../config/TryCatch.js";
import type { AuthenticatedRequest } from "../middlewares/isAuth.js";
import { Chat } from "../models/chat.js";
import { Messages } from "../models/Messages.js";
import { getReceiverSocketId, io } from "../config/socket.js";

export const createNewChat = TryCatch(
  async (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      console.log("User not found");
      return;
    }
    const userId = req.user._id;
    const { otherUserId } = req.body;
    if (!otherUserId) {
      res.status(400).json({ message: "Other userId is required" });
      return;
    }
    const existingChat = await Chat.findOne({
      users: { $all: [userId, otherUserId], $size: 2 },
    });
    if (existingChat) {
      res.json({ message: "Chat already exist", chatId: existingChat._id });
      return;
    }
    const newChat = await Chat.create({
      users: [userId, otherUserId],
    });
    res.status(201).json({ message: "New chat created", chatId: newChat._id });
  },
);

export const getAllChats = TryCatch(async (req: AuthenticatedRequest, res) => {
  const userId = req.user?._id;
  if (!userId) {
    res.status(400).json({ message: "UserId missing" });
    return;
  }
  const chats = await Chat.find({ users: userId }).sort({ updatedAt: -1 });
  const chatWithUserData = await Promise.all(
    chats.map(async (chat) => {
      const otherUserId = chat.users.find((id) => id !== userId);
      const unseenCount = await Messages.countDocuments({
        chatId: chat._id,
        sender: { $ne: userId },
        seen: false,
      });
      console.log("unseenCount: ", unseenCount);

      try {
        const { data } = await axios.get(
          `${process.env.USER_SERVICE}/api/v1/user/${otherUserId}`,
        );
        return {
          user: data,
          chat: {
            ...chat.toObject(),
            latestMessage: chat.latestMessage || null,
            unseenCount,
          },
        };
      } catch (error) {
        console.log(error);
        return {
          user: { _id: otherUserId, name: "Unknown User" },
          chat: {
            ...chat.toObject(),
            latestMessage: chat.latestMessage || null,
            unseenCount,
          },
        };
      }
    }),
  );
  res.json({ chats: chatWithUserData });
});

export const sendMessage = TryCatch(async (req: AuthenticatedRequest, res) => {
  const senderId = req.user?._id;
  const { chatId, text } = req.body;
  const imageFile = req.file;

  if (!senderId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  if (!chatId) {
    res.status(401).json({ message: "ChatId required" });
    return;
  }
  if (!text && !imageFile) {
    res.status(400).json({ message: "Either text or image is required" });
    return;
  }
  const chat = await Chat.findById(chatId);
  if (!chat) {
    res.status(404).json({ message: "Chat not found" });
    return;
  }
  const isUserInChat = chat.users.some(
    (userId) => userId.toString() === senderId.toString(),
  );
  if (!isUserInChat) {
    res.status(403).json({ message: "You are not a participant of this chat" });
    return;
  }
  const otherUserId = chat.users.find(
    (userId) => userId.toString() !== senderId.toString(),
  );
  if (!otherUserId) {
    res.status(401).json({ message: "No other user" });
    return;
  }

  //socket setup
  const receiverSocketId = getReceiverSocketId(otherUserId.toString());
  let isReceiverInChatRoom = false;
  if (receiverSocketId) {
    const receiverSocket = io.sockets.sockets.get(receiverSocketId);
    if (receiverSocket && receiverSocket.rooms.has(chatId)) {
      isReceiverInChatRoom = true;
    }
  }

  let messageData: any = {
    chatId: chatId,
    sender: senderId,

    seen: isReceiverInChatRoom, // mark as seen if receiver is in the chat room
    seenAt: isReceiverInChatRoom ? new Date() : undefined, // set seenAt if receiver is in the chat room
  };
  if (imageFile) {
    messageData.images = {
      url: (imageFile as any).path,
      publicId: (imageFile as any).filename,
    };
    messageData.messageType = "image";
    messageData.text = text || "";
  } else {
    messageData.text = text;
    messageData.messageType = "text";
  }
  const message = new Messages(messageData);
  const savedMessage = await message.save();
  const latestMessageText = imageFile ? "📷 Image" : text;
  await Chat.findByIdAndUpdate(
    chatId,
    {
      latestMessage: {
        text: latestMessageText,
        sender: senderId,
      },
      updatedAt: new Date(),
    },
    { new: true },
  );
  //emit to socket
  // 1. Emit to everyone in the chat room (covers users actively viewing this chat)
  io.to(chatId).emit("newMessage", savedMessage);

  // 2. If receiver is NOT in the chat room, send directly so their sidebar/notification updates
  if (receiverSocketId && !isReceiverInChatRoom) {
    io.to(receiverSocketId).emit("newMessage", savedMessage);
  }

  // 3. If receiver saw the message immediately, notify sender about "seen" status
  const senderSocketId = getReceiverSocketId(senderId.toString());
  if (isReceiverInChatRoom && senderSocketId) {
    io.to(senderSocketId).emit("messagesSeen", {
      chatId,
      seenBy: otherUserId,
      messageIds: [savedMessage._id],
    });
  }

  res.status(201).json({ message: savedMessage, sender: senderId });
});

export const getMessageByChat = TryCatch(
  async (req: AuthenticatedRequest, res) => {
    const userId = req.user?._id;
    const { chatId } = req.params;
    if (!userId) {
      res.status(401).json({
        message: "Unauthorized",
      });
      return;
    }

    if (!chatId) {
      res.status(400).json({
        message: "ChatId Required",
      });
      return;
    }
    const chat = await Chat.findById(chatId);
    if (!chat) {
      res.status(404).json({
        message: "Chat not found",
      });
      return;
    }
    const isUserInChat = chat.users.some(
      (id) => id.toString() === userId.toString(),
    );
    if (!isUserInChat) {
      res
        .status(403)
        .json({ message: "You are not a participant of this chat" });
      return;
    }
    const messagesToMarkSeen = await Messages.find({
      chatId: chatId,
      sender: { $ne: userId },
      seen: false,
    });
    await Messages.updateMany(
      {
        chatId: chatId,
        sender: { $ne: userId },
        seen: false,
      },
      {
        seen: true,
        seenAt: new Date(),
      },
    );
    const message = await Messages.find({ chatId }).sort({ createdAt: 1 });
    const otherUserId = chat.users.find(
      (id) => id.toString() !== userId.toString(),
    );
    if (!otherUserId) {
      res.status(400).json({
        message: "no other user",
      });
      return;
    }
    console.log("other user ", otherUserId, "me: ", userId);

    try {
      const { data } = await axios.get(
        `${process.env.USER_SERVICE}/api/v1/user/${otherUserId}`,
      );

      //socket work
      if (messagesToMarkSeen.length > 0) {
        const otherUserSocketId = getReceiverSocketId(otherUserId.toString());
        if (otherUserSocketId) {
          io.to(otherUserSocketId).emit("messagesSeen", {
            chatId,
            seenBy: userId,
            messageIds: messagesToMarkSeen.map((msg) => msg._id),
          });
        }
      }

      res.json({
        message,
        user: data,
      });
    } catch (error) {
      console.log(error);
      res.json({
        message,
        user: {
          _id: otherUserId,
          name: "Unknown",
        },
      });
    }
  },
);
