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

  peer.on('open', () => {
    // ホスト(部屋ID)に対して呼び出し。受信専用なので空ストリームを渡す。
    call = peer.call(roomId, new MediaStream());
    if (!call) {
      $('overlayMsg').textContent = 'ホストに接続できませんでした。リンクを確認してください。';
      $('joinBtn').disabled = false;
      return;
    }

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
