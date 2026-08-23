import ws from 'k6/ws';
import { check } from 'k6';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

export const options = {
  stages: [
    { duration: '10s', target: 50 }, // simulate ramp-up of traffic from 1 to 50 users over 10s
    { duration: '30s', target: 50 }, // stay at 50 users for 30s
    { duration: '10s', target: 0 },  // ramp-down to 0 users
  ],
};

const ROOM_ID = 'load-test-room';

export default function () {
  const url = `ws://localhost:4000/ws/rooms/${ROOM_ID}`;
  const params = { tags: { my_tag: 'hello' } };

  const res = ws.connect(url, params, function (socket) {
    socket.on('open', () => {
      // Send a dummy binary message (normally this would be a Yjs sync step 1)
      // Since it's a raw WS load test, we're mostly testing connection concurrency and latency
      socket.sendBinary(new ArrayBuffer(4));
    });

    socket.on('message', (data) => {
      // backend sends Sync Step 1 immediately on connect
      // We can record the latency here if we had custom ping/pong
    });

    socket.setTimeout(function () {
      socket.close();
    }, 15000); // 15 seconds per client session
  });

  check(res, { 'status is 101': (r) => r && r.status === 101 });
}
