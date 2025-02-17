import { createServer } from "http";
import { Server } from "socket.io";
import express from "express";

const app = express();
const http = createServer(app);
const io = new Server(http);

const waitingUsers = []; // 待機中のユーザーリスト

// 静的ファイルを提供
app.use(express.static("public"));

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // マッチング要求
  socket.on("find_match", () => {
    waitingUsers.push(socket.id);
    console.log(`Added ${socket.id} to waitingUsers:`, waitingUsers);

    // 2人以上待機中の場合はペアを作成
    if (waitingUsers.length >= 2) {
      const userA = waitingUsers.shift();
      const userB = waitingUsers.shift();
      const room = `room_${Date.now()}`;
      console.log(`Creating room: ${room} with ${userA} and ${userB}`);

      // ユーザーを部屋に追加
      io.to(userA).socketsJoin(room);
      io.to(userB).socketsJoin(room);

      // ペア成立を通知
      io.to(room).emit("match_found", { room });
    }
  });

  // 切断時にwaitingUsersから削除
  socket.on("disconnect", () => {
    const index = waitingUsers.indexOf(socket.id);
    if (index !== -1) {
      waitingUsers.splice(index, 1); // 配列から削除
      console.log(`User disconnected: ${socket.id}, removed from waitingUsers`);
    }
  });

  // その他のイベント処理
  socket.onAny((event, data) => {
    socket.broadcast.emit(event, data);
  });
});

// サーバー起動
const PORT = process.env.PORT || 3000;
http.listen(PORT,  "0.0.0.0", () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});
