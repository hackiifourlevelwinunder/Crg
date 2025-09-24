const express = require('express');
const http = require('http');
const { randomInt } = require('crypto');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const PORT = process.env.PORT || 3000;
app.use(express.static('public'));

// Round state
let rounds = {}; // roundId -> { number, startedAt, finalAt }
let lastRoundId = null;

function roundIdFromDate(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`;
}

function generateNumber() {
  return randomInt(0, 10); // 0..9
}

function scheduleTick() {
  setInterval(() => {
    const now = new Date();
    const sec = now.getUTCSeconds();
    const id = roundIdFromDate(new Date(now.getTime()));

    if (sec === 1) {
      const rid = id;
      if (!rounds[rid]) {
        const num = generateNumber();
        const startedAt = new Date(now.getTime());
        const finalAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes()+1, 0));
        rounds[rid] = { number: num, startedAt, finalAt };
        lastRoundId = rid;
        io.emit('round_event', { type: 'new', roundId: rid, number: num, startedAt: startedAt.toISOString(), finalAt: finalAt.toISOString() });
        console.log(`[${new Date().toISOString()}] GENERATED round ${rid} => ${num}`);
      }
    }

    if (sec === 30) {
      const prevDate = new Date(now.getTime() - 60_000);
      const prevId = roundIdFromDate(prevDate);
      if (rounds[prevId]) {
        io.emit('round_event', { type: 'previous', roundId: prevId, number: rounds[prevId].number, when: now.toISOString() });
        console.log(`[${new Date().toISOString()}] BROADCAST previous ${prevId} => ${rounds[prevId].number}`);
      } else {
        io.emit('round_event', { type: 'previous', roundId: prevId, number: null, when: now.toISOString() });
      }
    }

    if (sec === 0) {
      const prevDate = new Date(now.getTime() - 60_000);
      const currRoundId = roundIdFromDate(prevDate);
      if (rounds[currRoundId]) {
        io.emit('round_event', { type: 'final', roundId: currRoundId, number: rounds[currRoundId].number, when: now.toISOString() });
        console.log(`[${new Date().toISOString()}] FINAL ${currRoundId} => ${rounds[currRoundId].number}`);
      } else {
        io.emit('round_event', { type: 'final', roundId: currRoundId, number: null, when: now.toISOString() });
      }

      const cutoff = Date.now() - 10*60*1000;
      Object.keys(rounds).forEach(rid => {
        if (new Date(rounds[rid].startedAt).getTime() < cutoff) delete rounds[rid];
      });
    }

    const nextFinal = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes()+1, 0));
    const msToNextFinal = nextFinal.getTime() - now.getTime();
    io.emit('heartbeat', { serverTime: now.toISOString(), msToNextFinal });
  }, 1000);
}

io.on('connection', (socket) => {
  console.log('client connected', socket.id);
  const now = new Date();
  const nextFinal = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes()+1, 0));
  socket.emit('init', { serverTime: now.toISOString(), msToNextFinal: nextFinal.getTime() - now.getTime(), lastRoundId, rounds });

  socket.on('disconnect', () => {
    console.log('client disconnected', socket.id);
  });
});

scheduleTick();

server.listen(PORT, () => {
  console.log(`RCG CSPRNG server running on port ${PORT}`);
});