// ホスト側ロジック（PeerJS シグナリング + WebRTC P2P）
import { PEER_CONFIG, randomRoomId, tuneSenders } from '/peer.js';

const $ = (id) => document.getElementById(id);

let localStream = null;
let peer = null;       // PeerJS の Peer
let activeCall = null; // 参加者との MediaConnection
let roomId = null;
let statsTimer = null;

// ---- ステップ1: 画面共有を開始 -------------------------------------------
$('startBtn').addEventListener('click', async () => {
  try {
    localStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        frameRate: { ideal: 60, max: 60 }, // 動きを滑らかに
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: {
        // 音声処理を切ってそのまま流す＝遅延と加工を避ける
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        sampleRate: 48000,
      },
    });
  } catch (err) {
    if (err && err.name === 'NotAllowedError') return; // ユーザーがキャンセル
    alert('画面共有を開始できませんでした: ' + (err?.message || err));
    return;
  }

  // 画面共有は「動き重視」をヒント（テキスト主体なら 'detail' に）
  const vTrack = localStream.getVideoTracks()[0];
  if (vTrack && 'contentHint' in vTrack) vTrack.contentHint = 'motion';
  vTrack?.addEventListener('ended', stopSharing); // ブラウザの「共有を停止」対応

  $('preview').srcObject = localStream;
  $('stepStart').classList.add('hidden');
  $('stepLive').classList.remove('hidden');
  $('mAudio').textContent = localStream.getAudioTracks().length ? 'あり' : 'なし（共有時に音声を含めてください）';

  startStatsLoop();
});

// ---- ステップ2: 招待リンク作成（= PeerJS で待ち受け開始） -----------------
$('inviteBtn').addEventListener('click', () => {
  if (typeof Peer === 'undefined') {
    alert('シグナリングライブラリの読み込みに失敗しました。通信環境を確認して再読み込みしてください。');
    return;
  }
  roomId = randomRoomId();
  const link = `${location.origin}/view?room=${encodeURIComponent(roomId)}`;
  $('linkInput').value = link;
  $('inviteArea').classList.add('hidden');
  $('linkArea').classList.remove('hidden');

  startPeer();
});

$('copyBtn').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('linkInput').value);
    $('copyBtn').textContent = 'コピー済み ✓';
    setTimeout(() => ($('copyBtn').textContent = 'コピー'), 1500);
  } catch {
    $('linkInput').select();
    document.execCommand('copy');
  }
});

$('stopBtn').addEventListener('click', stopSharing);

// ---- PeerJS: 部屋IDで待ち受け、参加者の呼び出しに画面で応答 ---------------
function startPeer() {
  // 部屋ID = PeerのID。参加者はこのIDに対して call してくる。
  peer = new Peer(roomId, PEER_CONFIG);

  peer.on('open', () => setPeerStatus('参加者の接続を待っています…', 'wait'));

  peer.on('call', (call) => {
    activeCall = call;
    // 参加者からの呼び出しに、こちらの画面ストリームで応答する
    call.answer(localStream);
    setPeerStatus('参加者が接続しました ✓ 共有中', 'live');

    // 内部の RTCPeerConnection を取り出して低遅延チューニング
    if (call.peerConnection) tuneSenders(call.peerConnection);

    call.on('close', () => setPeerStatus('参加者が退出しました。再接続を待っています…', 'wait'));
  });

  peer.on('error', (err) => {
    console.error(err);
    if (err.type === 'unavailable-id') {
      setPeerStatus('IDが使用中です。リンクを作り直してください。', 'wait');
    } else if (err.type === 'peer-unavailable') {
      // 参加者がまだ来ていないだけ。無視。
    } else {
      setPeerStatus('接続エラー: ' + err.type, 'wait');
    }
  });
}

function setPeerStatus(text, mode) {
  $('peerStatus').textContent = text;
  $('statusPill').className = 'status ' + (mode === 'wait' ? 'wait' : 'live');
}

function stopSharing() {
  if (statsTimer) clearInterval(statsTimer);
  if (activeCall) { try { activeCall.close(); } catch {} activeCall = null; }
  if (peer) { try { peer.destroy(); } catch {} peer = null; }
  if (localStream) localStream.getTracks().forEach((t) => t.stop());
  localStream = null;
  $('stepLive').classList.add('hidden');
  $('stepStart').classList.remove('hidden');
  $('inviteArea').classList.remove('hidden');
  $('linkArea').classList.add('hidden');
}

// ---- 統計表示（解像度・FPS・ビットレート） --------------------------------
let lastBytes = 0, lastTs = 0;
function startStatsLoop() {
  const vTrack = localStream.getVideoTracks()[0];
  statsTimer = setInterval(async () => {
    const s = vTrack?.getSettings?.() || {};
    if (s.width) $('mRes').textContent = `${s.width}×${s.height}`;
    if (s.frameRate) $('mFps').textContent = Math.round(s.frameRate);

    const pc = activeCall?.peerConnection;
    if (pc) {
      const stats = await pc.getStats();
      stats.forEach((r) => {
        if (r.type === 'outbound-rtp' && r.kind === 'video') {
          const now = r.timestamp;
          if (lastTs) {
            const kbps = ((r.bytesSent - lastBytes) * 8) / (now - lastTs);
            $('mBitrate').textContent = `${(kbps / 1000).toFixed(1)} Mbps`;
          }
          lastBytes = r.bytesSent; lastTs = now;
        }
      });
    }
  }, 1000);
}
