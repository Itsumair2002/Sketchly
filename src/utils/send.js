const { WebSocket } = require('ws');

const send = (ws, type, payload = {}, requestId) => {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const message = { type, payload };
  if (requestId) message.requestId = requestId;
  ws.send(JSON.stringify(message));
};

module.exports = send;
