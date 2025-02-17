import "/socket.io/socket.io.js";

const pc = new RTCPeerConnection({
  iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
});
const socket = io();

// 待機表示用の要素を作成
const waitingDiv = document.createElement("div");
waitingDiv.style.position = "fixed";
waitingDiv.style.top = "50%";
waitingDiv.style.left = "50%";
waitingDiv.style.transform = "translate(-50%, -50%)";
waitingDiv.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
waitingDiv.style.color = "white";
waitingDiv.style.padding = "20px";
waitingDiv.style.borderRadius = "10px";
waitingDiv.style.display = "none";
document.body.appendChild(waitingDiv);

// 待機時間を更新する関数
let waitingTimer;
function updateWaitingTime(startTime) {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  waitingDiv.textContent = `待機中... ${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// ユーザーごとに状態を区別するための設定
const localVideoId = "localVideo"; // 自分のビデオに割り当てるID
let isWaiting = false; // 待機中状態を管理

globalThis.onClickBtn = async () => {
  // 自分側のビデオ要素が既に存在するかチェック
  if (document.querySelector("#localVideo")) {
    return; // 既に自分側のビデオが表示されている場合、処理を終了
  }
  // カメラとマイクのアクセスをリクエスト
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: true,
  });

  // 映像を表示
  const video = document.createElement("video");
  video.id = "localVideo"; // 自分側のビデオ要素に特定のIDを付与
  video.playsInline = true;
  video.muted = true;
  video.style.width = "50%";
  video.srcObject = stream;
  video.play();
  document.body.appendChild(video);

  // MediaStreamをRTCPeerConnectionに追加
  for (const track of stream.getTracks()) {
    pc.addTrack(track);
  }

  // マッチングをリクエスト
  socket.emit("find_match");
  
  // 待機表示を開始
  waitingDiv.style.display = "block";
  const startTime = Date.now();
  updateWaitingTime(startTime);
  waitingTimer = setInterval(() => updateWaitingTime(startTime), 1000);

  // ローカルのオファーを生成
  pc.createOffer().then((desc) => {
    pc.setLocalDescription(desc);
    socket.emit("offer", desc);
  });
  // 相手が準備が整うまで待機
  socket.emit("ready");

  // リモートのトラックを処理
  socket.on("ready", () => {
    // 両者が準備が整った場合に映像を表示
    waitingDiv.style.display = "none";
    document.body.appendChild(video);
    video.play();
  });
};

// リモートのトラックを処理
pc.addEventListener("track", ({ track }) => {
  const mediaElement = track.kind === "video" ? "video" : "audio";//mediastreamに相手のメディアを追加
  const element = document.createElement(mediaElement);
  element.playsInline = true; 
  if (mediaElement === "video") element.style.width = "100%";
  element.srcObject = new MediaStream([track]);
  element.play();
  document.body.appendChild(element);
  
  // 相手のメディアを受け取ったら待機表示を非表示にする
  waitingDiv.style.display = "none";
  clearInterval(waitingTimer);
});

// ICE Candidateを送信(イベント発生は, setlocaldescのタイミング)
pc.addEventListener("icecandidate", ({ candidate }) => {
  if (candidate) {
    socket.emit("ice", candidate);
  }
});

// ソケットイベントの処理
socket
  .on("offer", (desc) => {
    pc.setRemoteDescription(desc);
    pc.createAnswer().then((desc) => {
      pc.setLocalDescription(desc);
      socket.emit("answer", desc);
    });
  })
  .on("answer", (desc) => pc.setRemoteDescription(desc))
  .on("ice", (candidate) => pc.addIceCandidate(candidate));