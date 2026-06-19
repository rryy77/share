// 参加者（視聴）側ロジック（PeerJS シグナリング + WebRTC P2P）
import { PEER_CONFIG, minimizeReceiverDelay } from '/peer.js';

const $ = (id) => document.getElementById(id);
const roomId = new URLSearchParams(location.search).get('room');

let peer = null;
let call = null;

if (!roomId) {
  $('overlayTitle').textContent = 'リンクが正しくありません';
  $('overlayMsg').textContent = 'ホストから届いた招待リンクを開いてください。';
  $('joinBtn').classList.add('hidden');
}

$('joinBtn').addEventListener('click', () => {
  if (typeof Peer === 'undefined') {
    $('overlayMsg').textContent = 'シグナリングライブラリの読み込みに失敗しました。再読み込みしてください。';
    return;
  }
  $('joinBtn').disabled = true;
  $('overlayTitle').textContent = '接続中…';
  $('overlayMsg').textContent = 'ホストに接続しています。少しお待ちください。';
  connect();
});

function connect() {
  peer = new Peer(PEER_CONFIG);

  // ホストからの「呼び出し」を受けたら、受信専用で応答して映像を受け取る。
  // （ストリームを持つホスト側が発呼者になるので stream が確実に届く）
  peer.on('call', (incoming) => {
    call = incoming;
    call.answer(); // 受信専用：こちらからは何も送らない

    call.on('stream', (remoteStream) => {
      const video = $('remote');
      if (video.srcObject !== remoteStream) video.srcObject = remoteStream;

      // 受信バッファを最小化 → 遅延を可能な限り詰める
      if (call.peerConnection) minimizeReceiverDelay(call.peerConnection);

      video.play().catch(() => {});
      hideOverlay();
    });

    call.on('close', () => {
      showOverlay('共有が終了しました', 'ホストが画面共有を停止しました。');
    });
  });

  peer.on('open', () => {
    // データ接続でホストに自分の存在を知らせる（これを合図にホストが発呼する）
    const conn = peer.connect(roomId);
    conn.on('error', () => {
      showOverlay('ホストが見つかりません', 'ホストがまだ共有を開始していないか、リンクが古い可能性があります。');
      $('joinBtn').disabled = false;
    });
  });

  peer.on('error', (err) => {
    console.error(err);
    if (err.type === 'peer-unavailable') {
      showOverlay('ホストが見つかりません', 'ホストがまだ共有を開始していないか、リンクが古い可能性があります。');
    } else {
      showOverlay('接続エラー', String(err.type || err));
    }
    $('joinBtn').disabled = false;
  });
}

function showOverlay(title, msg) {
  $('overlay').classList.remove('hidden');
  $('overlayTitle').textContent = title;
  $('overlayMsg').textContent = msg;
  $('joinBtn').classList.add('hidden');
}
function hideOverlay() {
  $('overlay').classList.add('hidden');
}
