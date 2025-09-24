(() => {
  const socket = io();
  const display = document.getElementById('display');
  const status = document.getElementById('status');
  const serverTimeEl = document.getElementById('serverTime');
  const countdownEl = document.getElementById('countdown');

  socket.on('connect', () => { status.textContent = 'connected'; });
  socket.on('disconnect', () => { status.textContent = 'disconnected'; });

  socket.on('init', (data) => {
    serverTimeEl.textContent = new Date(data.serverTime).toLocaleString();
  });

  socket.on('heartbeat', (hb) => {
    serverTimeEl.textContent = new Date(hb.serverTime).toLocaleTimeString();
    countdownEl.textContent = Math.ceil(hb.msToNextFinal/1000) + 's';
  });

  socket.on('round_event', (ev) => {
    if (ev.type === 'previous') {
      display.textContent = `PREVIOUS: ${ev.number === null ? '—' : ev.number}`;
      status.textContent = 'previous shown at :30';
    } else if (ev.type === 'final') {
      display.textContent = `FINAL: ${ev.number === null ? '—' : ev.number}`;
      status.textContent = 'final at :00';
    } else if (ev.type === 'new') {
      display.textContent = `ROUND STARTED — waiting…`;
      status.textContent = `round ${ev.roundId} started`;
    }
  });
})();