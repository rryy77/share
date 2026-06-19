// WebRTC 共通設定・低遅延チューニング
//
// シグナリング（相手を見つける処理）は PeerJS のクラウド経由。
// 映像・音声そのものは PeerJS が張る WebRTC の P2P 直結で流れるため、
// サーバーを経由せず、トランスコードもバッファリングも入らない＝低遅延・音ズレ無し。
//
// ※ PeerJS 本体は HTML で CDN から読み込んでおり、グローバル `Peer` を使う。

export const PEER_CONFIG = {
  // PeerJS クラウドのシグナリングサーバーを利用（追加サーバー不要）
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
    bundlePolicy: 'max-bundle', // 映像と音声を1経路に束ねて同期を保つ
  },
};

// ランダムな部屋ID（招待リンクに使う）
export function randomRoomId() {
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return 'watch-' + Array.from(a, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 12);
}

// 送信側ビットレートを引き上げ、解像度を維持する（＝文字がにじまない）
// PeerJS の MediaConnection から内部 RTCPeerConnection を取り出して調整する。
export async function tuneSenders(pc, retries = 6) {
  const videoSender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
  if (!videoSender) {
    // 接続直後はまだ sender が出来ていないことがあるのでリトライ
    if (retries > 0) setTimeout(() => tuneSenders(pc, retries - 1), 250);
    return;
  }
  try {
    const params = videoSender.getParameters();
    if (!params.encodings || !params.encodings.length) params.encodings = [{}];
    params.encodings[0].maxBitrate = 12_000_000; // 12 Mbps
    params.encodings[0].networkPriority = 'high';
    params.degradationPreference = 'maintain-resolution';
    await videoSender.setParameters(params);
  } catch { /* 一部ブラウザ未対応でも致命的ではない */ }
}

// 受信側バッファを最小化して遅延を詰める（Chrome系で有効）
export function minimizeReceiverDelay(pc, retries = 6) {
  const receivers = pc.getReceivers();
  if (!receivers.length && retries > 0) {
    setTimeout(() => minimizeReceiverDelay(pc, retries - 1), 250);
    return;
  }
  for (const r of receivers) {
    if ('playoutDelayHint' in r) {
      try { r.playoutDelayHint = 0; } catch {}
    }
  }
}
