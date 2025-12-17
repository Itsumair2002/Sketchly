const send = require('./send');

const broadcast = (sockets, type, payload = {}, exclude) => {
  if (!sockets || sockets.size === 0) return;
  sockets.forEach((client) => {
    if (exclude && exclude === client) return;
    send(client, type, payload);
  });
};

module.exports = broadcast;
