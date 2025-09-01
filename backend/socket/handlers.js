const Conversation = require("../Models/Conversation.js");
const User = require("../Models/User.js");
const {
  getAiResponse,
  sendMessageHandler,
  deleteMessageHandler,
} = require("../Controllers/message_controller.js");

module.exports = (io, socket) => {
  let currentUserId = null;

  // Setup user in a room
  socket.on("setup", async (id) => {
    currentUserId = id;
    socket.join(id);
    console.log("User joined personal room", id);
    socket.emit("user setup", id);

    // change isOnline to true
    await User.findByIdAndUpdate(id, { isOnline: true });

    const conversations = await Conversation.find({
      members: { $in: [id] },
    });

    conversations.forEach((conversation) => {
      const sock = io.sockets.adapter.rooms.get(conversation.id);
      if (sock) {
        console.log("Other user is online is sent to: ", id);
        io.to(conversation.id).emit("receiver-online", {});
      }
    });
  });

  // Join chat room
  socket.on("join-chat", async (data) => {
    const { roomId, userId } = data;

    console.log("User joined chat room", roomId);
    const conv = await Conversation.findById(roomId);
    socket.join(roomId);

    // reset joined user unread to 0
    conv.unreadCounts = conv.unreadCounts.map((unread) => {
      if (unread.userId == userId) {
        unread.count = 0;
      }
      return unread;
    });
    await conv.save({ timestamps: false });

    io.to(roomId).emit("user-joined-room", userId);
  });

  // Leave chat room
  socket.on("leave-chat", (room) => {
    socket.leave(room);
  });

  const handleSendMessage = async (data) => {
    console.log("Received message: ");

    var isSentToBot = false;

    const { conversationId, senderId, text, imageUrl } = data;


    
    const conversation = await Conversation.findById(conversationId).populate(
      "members"
    );

    // processing for AI chatbot
    for (const member of conversation.members) {
      if (member._id.toString() !== senderId && member.email.endsWith("bot")) {
        isSentToBot = true;

        io.to(conversationId).emit("typing", { typer: member._id.toString() });

        const mockUserMessage = {
          id_: Date.now().toString(),
          conversationId,
          senderId,
          text,
          seenBy: [
            {
              user: member._id.toString(),
              seenAt: new Date(),
            },
          ],
          imageUrl,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        io.to(conversationId).emit("receive-message", mockUserMessage);

        const responseMessage = await getAiResponse(
          text,
          senderId,
          conversationId
        );

        if (responseMessage !== -1) {
          io.to(conversationId).emit("receive-message", responseMessage);
          io.to(conversationId).emit("stop-typing", {
            typer: member._id.toString(),
          });
        }
      }
    }

    if (isSentToBot) return;

    // personal chat
    const receiverId = conversation.members.find(
      (member) => member._id.toString() !== senderId
    )._id.toString();

    const receiverPersonalRoom = io.sockets.adapter.rooms.get(receiverId);

    let isReceiverInsideChatRoom = false;

    if (receiverPersonalRoom) {
      const receiverSid = Array.from(receiverPersonalRoom)[0];
      const chatRoom = io.sockets.adapter.rooms.get(conversationId);
      if (chatRoom && chatRoom.has(receiverSid)) {
        isReceiverInsideChatRoom = true;
      }
    }

    const message = await sendMessageHandler({
      text,
      imageUrl,
      senderId,
      conversationId,
      receiverId,
      isReceiverInsideChatRoom,
    });

    io.to(conversationId).emit("receive-message", message);

    // sending notification to receiver
    if (!isReceiverInsideChatRoom) {
      console.log("Emitting new message to: ", receiverId);
      io.to(receiverId).emit("new-message-notification", message);
    }
  };

  socket.on("send-message", handleSendMessage);

  const handleDeleteMessage = async (data) => {
    const { messageId, deleteFrom, conversationId } = data;
    const deleted = await deleteMessageHandler({ messageId, deleteFrom });
    if (deleted && deleteFrom.length > 1) {
      io.to(conversationId).emit("message-deleted", data);
    }
  };

  socket.on("delete-message", handleDeleteMessage);

  // Typing indicator
  socket.on("typing", (data) => {
    io.to(data.conversationId).emit("typing", data);
  });

  socket.on("stop-typing", (data) => {
    io.to(data.conversationId).emit("stop-typing", data);
  });

  // Explicit logout handler
  socket.on("logout", async () => {
    console.log("User logged out", currentUserId);

    try {
      await User.findByIdAndUpdate(currentUserId, {
        isOnline: false,
        lastSeen: new Date(),
      });

      const conversations = await Conversation.find({
        members: { $in: [currentUserId] },
      });

      conversations.forEach((conversation) => {
        io.to(conversation.id).emit("receiver-offline", {
          userId: currentUserId,
        });
      });

      socket.leave(currentUserId);
      socket.disconnect(true);
    } catch (error) {
      console.error("Error handling logout:", error);
    }
  });

  // Disconnect
  socket.on("disconnect", async () => {
    console.log("A user disconnected", currentUserId, socket.id);
    try {
      await User.findByIdAndUpdate(currentUserId, {
        isOnline: false,
        lastSeen: new Date(),
      });
    } catch (error) {
      console.error("Error updating user status on disconnect:", error);
    }

    const conversations = await Conversation.find({
      members: { $in: [currentUserId] },
    });

    conversations.forEach((conversation) => {
      const sock = io.sockets.adapter.rooms.get(conversation.id);
      if (sock) {
        console.log("Other user is offline is sent to: ", currentUserId);
        io.to(conversation.id).emit("receiver-offline", {});
      }
    });
  });
};
