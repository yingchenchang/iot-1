'use strict';
const $ = id => document.getElementById(id);
const P = window.LedProtocol;
const commandLabels = { BLUE_ON: '左邊開燈（藍燈）', GREEN_ON: '右邊開燈（綠燈）',
  BLUE_OFF: '左邊關燈（藍燈）', GREEN_OFF: '右邊關燈（綠燈）', ALL_OFF: '全部關燈',
  BLINK_THREE: '閃爍三次（藍綠燈同步）', STATUS: '讀取狀態' };
const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
let port = null, reader = null, writer = null, readTask = null;
let pending = null, ready = false, connecting = false, closing = false, busy = false;
let portOpened = false;
let recognition = null, speechAccepted = false, cancelled = false;
let sequence = Math.floor(Math.random() * 1000000000);

function controls() {
  $('connect').disabled = !!port || connecting || closing;
  $('disconnect').disabled = !port || connecting || closing;
  const disabled = !ready || busy || !!recognition;
  for (const element of document.querySelectorAll('[data-command], #send, #refresh')) element.disabled = disabled;
  $('listen').disabled = disabled || !Speech;
  $('stop').disabled = !recognition;
}
function unknown() {
  for (const color of ['blue', 'green']) {
    $(color + 'State').textContent = '未知';
    $(color + 'Card').classList.remove('on', 'off');
  }
  $('updated').textContent = '沒有有效的最新回報；請重新連線或讀取狀態。';
}
function showState(state) {
  for (const color of ['blue', 'green']) {
    $(color + 'State').textContent = state[color] ? '亮（開發板回報）' : '滅（開發板回報）';
    $(color + 'Card').classList.toggle('on', state[color]);
    $(color + 'Card').classList.toggle('off', !state[color]);
  }
  $('updated').textContent = `GPIO 回讀時間：${new Date().toLocaleTimeString()}。此回報不代表已量測 LED 發光。`;
}
function execution(text, error = false) {
  $('execution').textContent = text;
  $('execution').classList.toggle('error', error);
}
function rejectPending(error) {
  if (!pending) return;
  const item = pending; pending = null;
  clearTimeout(item.timer); item.reject(error);
}
function onLine(line) {
  const state = P.parseReply(line);
  if (!state || !pending || state.id !== pending.id) return;
  const item = pending; pending = null; clearTimeout(item.timer);
  if (!state.ok) item.reject(new Error('開發板拒絕此指令。'));
  else if (!P.matches(item.command, state)) item.reject(new Error('開發板 GPIO 回報與指令不符。'));
  else item.resolve(state);
}
async function readLoop() {
  const decoder = new TextDecoder();
  let buffer = '', dropping = false;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      for (const c of decoder.decode(value, { stream: true })) {
        if (c === '\n') {
          if (!dropping) onLine(buffer);
          buffer = ''; dropping = false;
        } else if (!dropping) {
          buffer += c;
          if (buffer.length > 256) { buffer = ''; dropping = true; }
        }
      }
    }
  } catch (error) {
    if (!closing) execution(`USB 讀取失敗：${error.message}`, true);
  } finally {
    reader.releaseLock(); reader = null;
    rejectPending(new Error('USB 連線已中斷。'));
    ready = false; unknown(); controls();
    if (!closing) {
      $('connection').textContent = '連線中斷';
      setTimeout(() => disconnect(), 0);
    }
  }
}
async function request(command) {
  if (!writer || pending) throw new Error('連線未就緒或仍有指令等待回覆。');
  const id = String(++sequence);
  return new Promise((resolve, reject) => {
    pending = { id, command, resolve, reject,
      timer: setTimeout(() => rejectPending(new Error('等待回覆逾時；指令可能已執行，狀態未知。請讀取狀態，勿假設已成功。')), 2500) };
    // Leading newline also clears a partial frame left by an earlier connection.
    writer.write(new TextEncoder().encode(`\nV1 ${id} ${command}\n`)).catch(error => {
      if (pending?.id === id) rejectPending(error);
    });
  });
}
async function perform(command, silent = false) {
  if (!ready || busy) { if (!silent) execution('尚未連線或上一個指令仍在處理，未送出。', true); return; }
  busy = true; controls();
  if (!silent) execution(`已送出「${commandLabels[command]}」，等待開發板確認…`);
  try {
    const state = await request(command);
    showState(state);
    if (!silent) execution(`已確認：「${commandLabels[command]}」（開發板回覆 #${state.id}）`);
  } catch (error) {
    unknown(); execution(error.message, true);
  } finally { busy = false; controls(); }
}
async function disconnect() {
  if (closing) return;
  closing = true; ready = false; cancelled = true;
  recognition?.abort(); controls();
  rejectPending(new Error('連線已關閉；尚未確認的指令狀態未知。'));
  try {
    if (reader) await reader.cancel();
    if (readTask) await readTask;
    if (writer) { writer.releaseLock(); writer = null; }
    if (port && portOpened) await port.close();
  } catch (error) { execution(`關閉連線：${error.message}`, true); }
  finally {
    port = null; portOpened = false; readTask = null; closing = false;
    $('connection').textContent = '尚未連線'; unknown(); controls();
  }
}
$('connect').onclick = async () => {
  connecting = true; controls();
  let stage = 'select';
  try {
    if (!window.isSecureContext || !navigator.serial) throw new Error('請使用電腦版 Chrome 開啟 http://localhost:8765。');
    port = await navigator.serial.requestPort();
    stage = 'open';
    await port.open({ baudRate: 115200 });
    portOpened = true;
    writer = port.writable.getWriter(); reader = port.readable.getReader();
    readTask = readLoop();
    stage = 'handshake';
    $('connection').textContent = '正在核對開發板回覆…';
    // Allow the board to finish booting after the port opens.
    await new Promise(resolve => setTimeout(resolve, 1500));
    // Only retry read-only status queries while the board is booting.
    let state;
    for (let attempt = 1; attempt <= 3; attempt++) {
      $('connection').textContent = `USB 已開啟，等待板卡回覆（${attempt}/3）…`;
      try { state = await request('STATUS'); break; }
      catch (error) {
        if (attempt === 3 || !reader || closing) throw error;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    ready = true; showState(state);
    $('connection').textContent = '已連線 · AMB82-MINI';
    execution('已收到開發板回覆，可開始語音控制。');
  } catch (error) {
    await disconnect();
    if (stage === 'open') {
      execution(`無法開啟 USB 連接埠：${error.message}。請關閉其他控制網頁分頁、Arduino 序列監控器及 Terminal 控制程式，再重新連接；若仍失敗，拔插 USB 後選 COM3。`, true);
    } else if (stage === 'handshake') {
      execution(`USB 已開啟，但沒有取得本專案的有效回覆：${error.message}。請拔除 USB 等 3 秒再插回（不要按住 UART_DOWNLOAD），並確認板上燒錄的是 VoiceRecognitionBlueGreenLEDs，而非交替閃爍程式。`, true);
    } else {
      execution(error.name === 'NotFoundError' ? '未選取連接埠，請按「連接開發板」並選擇 AMB82 的 COM3。' : `無法選取連接埠：${error.message}`, true);
    }
  } finally { connecting = false; controls(); }
};
$('disconnect').onclick = disconnect;
$('refresh').onclick = () => perform('STATUS');
for (const button of document.querySelectorAll('[data-command]')) button.onclick = () => perform(button.dataset.command);
function acceptText(text) {
  $('transcript').textContent = text || '（沒有辨識到文字）';
  const command = P.recognize(text);
  if (!command) { execution('不是支援的完整口令，未送出控制指令；LED 狀態不變。', true); return; }
  perform(command);
}
$('textForm').onsubmit = event => { event.preventDefault(); if (!recognition) acceptText($('text').value); };
$('listen').onclick = () => {
  if (!Speech || !ready || busy || recognition) return;
  recognition = new Speech();
  recognition.lang = 'zh-TW'; recognition.continuous = false; recognition.interimResults = false; recognition.maxAlternatives = 1;
  speechAccepted = false; cancelled = false;
  $('speechStatus').textContent = '正在聆聽，請說一個口令…'; controls();
  recognition.onresult = event => {
    if (cancelled || speechAccepted) return;
    const result = event.results[event.resultIndex];
    if (!result.isFinal) return;
    speechAccepted = true;
    $('speechStatus').textContent = '辨識完成'; acceptText(result[0].transcript);
  };
  recognition.onerror = event => {
    cancelled = true;
    const messages = { 'not-allowed': '麥克風權限遭拒，請在網址列允許麥克風。', 'audio-capture': '找不到可用的麥克風。', 'no-speech': '沒有聽到語音，請再試一次。', network: '語音辨識服務連線失敗，請檢查網路。', aborted: '已取消辨識。', 'service-not-allowed': '瀏覽器不允許此辨識服務，請改用電腦版 Chrome。' };
    $('speechStatus').textContent = messages[event.error] || `辨識失敗：${event.error}`;
    if (!speechAccepted) execution('本次未送出控制指令。');
  };
  recognition.onend = () => {
    if (!speechAccepted && !cancelled) $('speechStatus').textContent = '未取得辨識結果，請再試一次。';
    recognition = null; controls();
  };
  try { recognition.start(); } catch (error) {
    recognition = null; $('speechStatus').textContent = `無法啟動辨識：${error.message}`; controls();
  }
};
$('stop').onclick = () => { cancelled = true; recognition?.abort(); $('speechStatus').textContent = '已取消聆聽。'; };
setInterval(() => { if (ready && !busy && !recognition) perform('STATUS', true); }, 3000);
if (!Speech) $('speechStatus').textContent = '此瀏覽器不支援語音辨識，請使用電腦版 Chrome；仍可用文字測試。';
if (!navigator.serial) $('connection').textContent = '此瀏覽器不支援 Web Serial，請使用電腦版 Chrome。';
controls();
