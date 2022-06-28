import { createServer } from "http";
import { Server } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import { saveSession, findSession, findAllSessions } from "./src/sessionStorage.js"
import { findMessagesForUser, saveMessage } from "./src/messageStorage.js";

const httpServer = createServer();
const io = new Server(httpServer, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"],
    }
});

io.use((socket, next) => {
    // 檢查session是否存在
    const sessionId = socket.handshake.auth.sessionId;
    if (sessionId) {
        const session = findSession(sessionId);
        if (session) {
            socket.sessionId = sessionId;
            socket.userId = session.userId;
            socket.username = session.username;
            return next();
        } else {
            return next(new Error("Invalid session"));
        }
    }

    const username = socket.handshake.auth.username;
    if (!username) {
        return next(new Error("Invalid username"));
    }
    socket.username = username;
    socket.userId = uuidv4();
    socket.sessionId = uuidv4();
    next();
});
// 存訊息
function getMessagesForUser(userId) {
    const messagesPerUser = new Map();
    findMessagesForUser(userId).forEach((message) => {
        const { from, to } = message;
        const otherUser = userId === from ? to : from;
        if (messagesPerUser.has(otherUser)) {
            messagesPerUser.get(otherUser).push(message);
        } else {
            messagesPerUser.set(otherUser, [message]);
        }
    })
    return messagesPerUser;
}

io.on("connection", async (socket) => {
    saveSession(socket.sessionId, {
        userId: socket.userId,
        username: socket.username,
        connected: true,
    });

    socket.join(socket.userId);

    //get all connected users
    //取得所有已連線的使用者
    const users = [];
    const userMessages = getMessagesForUser(socket.userId);
    findAllSessions().forEach((session) => {
        if (session.userId !== socket.userId) {
            users.push({
                userId: session.userId,
                username: session.username,
                connected: session.connected,
                messages: userMessages.get(session.userId) || [],
            });
        }
    });

    //all users event
    socket.emit("users", users);

    // connected user details event
    socket.emit("session", {
        sessionId: socket.sessionId,
        userId: socket.userId,
        username: socket.username,
    });
    // new user event
    socket.broadcast.emit("user connected", {
        userId: socket.userId,
        username: socket.username,
    });
    //私訊event 
    socket.on("private message", ({ content, to }) => {
        const message = {
            from: socket.userId,
            to,
            content,
        };
        socket.to(to).emit("private message", message);
        saveMessage(message)
    });

    socket.on("user messages", ({ userId, username }) => {
        const userMessages = getMessagesForUser(socket.userId)
        socket.emit("user messages", {
            userId,
            username,
            messages: userMessages.get(userId) || [],
        });
    })


    socket.on("disconnect", async () => {
        const matchingSockets = await io.in(socket.userId).allSockets();
        const isDisconnected = matchingSockets.size === 0;
        if (isDisconnected) {
            // 通知其他用戶
            socket.broadcast.emit("user disconnected", {
                userId: socket.userId,
                username: socket.username,
            });
            // 更新session的連接狀態
            saveSession(socket.sessionId, {
                userId: socket.userId,
                username: socket.username,
                connected: socket.connected,
            })
        }


    })
})

console.log("Listening to port...");
httpServer.listen(process.env.PORT || 4000);