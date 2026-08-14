const action = process.argv[2];
const pages = await fetch("http://127.0.0.1:9222/json").then((response) => response.json());
const page = pages.find((item) => item.type === "page");

if (!page) throw new Error("No Electron renderer page found");

const expressions = {
  collapse: 'document.querySelector("button[aria-label=\\"折叠便签目录\\"]")?.click()',
  settings: 'document.querySelector(".settings-trigger")?.click()',
};
const expression = expressions[action];

if (!expression) throw new Error(`Unknown QA action: ${action}`);

const socket = new WebSocket(page.webSocketDebuggerUrl);
const result = await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error("CDP request timed out")), 5000);
  socket.addEventListener("open", () => {
    socket.send(JSON.stringify({
      id: 1,
      method: "Runtime.evaluate",
      params: { expression, returnByValue: true },
    }));
  });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id !== 1) return;
    clearTimeout(timeout);
    resolve(message.result?.result?.value);
  });
});

socket.close();
console.log(JSON.stringify({ action, result }));
