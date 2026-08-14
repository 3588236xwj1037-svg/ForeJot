const port = Number(process.argv[2]);

if (!Number.isFinite(port)) {
  throw new Error("Usage: node scripts/memory-scenario.mjs <remote-debugging-port>");
}

const pages = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json());
const page = pages.find((item) => item.type === "page");
if (!page) throw new Error("No Electron renderer page found");

const socket = new WebSocket(page.webSocketDebuggerUrl);
let requestId = 0;
const pending = new Map();

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  const request = pending.get(message.id);
  if (!request) return;
  pending.delete(message.id);
  if (message.error) request.reject(new Error(message.error.message));
  else request.resolve(message.result);
});

await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

function send(method, params = {}) {
  requestId += 1;
  socket.send(JSON.stringify({ id: requestId, method, params }));
  return new Promise((resolve, reject) => pending.set(requestId, { resolve, reject }));
}

const scenario = await send("Runtime.evaluate", {
  awaitPromise: true,
  returnByValue: true,
  expression: `(async () => {
    const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
    const input = document.querySelector('input[aria-label="插入图片文件"]');
    if (!input) return { ok: false, reason: 'image input missing' };
    const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='), (value) => value.charCodeAt(0));
    const transfer = new DataTransfer();
    transfer.items.add(new File([png, new Uint8Array(2 * 1024 * 1024)], 'memory-check.png', { type: 'image/png' }));
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await wait(400);

    for (let index = 0; index < 50; index += 1) {
      const textarea = document.querySelector('textarea[aria-label="便签内容"]');
      if (!textarea) return { ok: false, reason: 'editor missing' };
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
      setter.call(textarea, textarea.value + String(index % 10));
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      await wait(18);
    }

    await wait(600);
    const textarea = document.querySelector('textarea[aria-label="便签内容"]');
    return {
      ok: true,
      bodyLength: textarea?.value.length ?? 0,
      hasShortImageToken: textarea?.value.includes('note-asset:') ?? false,
      exportDomMounted: Boolean(document.querySelector('.export-source')),
    };
  })()`,
});

await send("HeapProfiler.collectGarbage");
const heap = await send("Runtime.getHeapUsage");
socket.close();

console.log(JSON.stringify({ scenario: scenario.result?.value, heap }, null, 2));
