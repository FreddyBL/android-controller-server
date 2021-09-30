export function sendMessage(ws, type, payload) {
  const json = JSON.stringify({
    type,
    payload,
  });
  ws.send(json);
}
