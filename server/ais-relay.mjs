import process from 'node:process';

import WebSocket, { WebSocketServer } from 'ws';

const AISSTREAM_URL = 'wss://stream.aisstream.io/v0/stream';
const MESSAGE_TYPES = [
  'PositionReport',
  'StandardClassBPositionReport',
  'ExtendedClassBPositionReport',
  'ShipStaticData',
  'StaticDataReport',
];
const apiKey = process.env.AISSTREAM_API_KEY;
const port = Number(process.env.AIS_RELAY_PORT ?? 8790);
const host = process.env.AIS_RELAY_HOST ?? '127.0.0.1';
const maximumClients = Number(process.env.AIS_RELAY_MAX_CLIENTS ?? 10);

if (!apiKey) {
  console.error('AISSTREAM_API_KEY is required.');
  process.exit(1);
}

const clients = new Map();
const connectedClients = new Set();
const server = new WebSocketServer({ host, port, maxPayload: 16 * 1024 });
let upstream = null;
let reconnectTimer = null;
let subscriptionTimer = null;
let reconnectDelay = 1_000;
let upstreamReady = false;
let upstreamFailed = false;
let lastSubscriptionSentAt = 0;

function originAllowed(origin) {
  if (!origin) {
    return true;
  }

  const configuredOrigins = process.env.AIS_RELAY_ALLOWED_ORIGINS;
  if (configuredOrigins) {
    return configuredOrigins
      .split(',')
      .map((value) => value.trim())
      .includes(origin);
  }

  try {
    const hostname = new URL(origin).hostname;
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

function sendStatus(client, status, error) {
  if (client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify({ type: 'status', status, error }));
  }
}

function broadcastStatus(status, error) {
  for (const client of clients.keys()) {
    sendStatus(client, status, error);
  }
}

function validCoordinate(value, min, max) {
  return typeof value === 'number' && value >= min && value <= max;
}

function validBoundingBox(value) {
  return (
    value &&
    validCoordinate(value.southWest?.latitude, -90, 90) &&
    validCoordinate(value.southWest?.longitude, -180, 180) &&
    validCoordinate(value.northEast?.latitude, -90, 90) &&
    validCoordinate(value.northEast?.longitude, -180, 180)
  );
}

function upstreamBoundingBoxes() {
  return [...clients.values()].map(({ bounds }) => {
    const { southWest, northEast } = bounds;
    return [
      [southWest.latitude, southWest.longitude],
      [northEast.latitude, northEast.longitude],
    ];
  });
}

function sendSubscription() {
  if (subscriptionTimer) {
    clearTimeout(subscriptionTimer);
    subscriptionTimer = null;
  }
  if (upstream?.readyState !== WebSocket.OPEN) {
    return;
  }

  const boundingBoxes = upstreamBoundingBoxes();
  if (boundingBoxes.length === 0) {
    upstream.close();
    return;
  }

  upstream.send(
    JSON.stringify({
      APIKey: apiKey,
      BoundingBoxes: boundingBoxes,
      FilterMessageTypes: MESSAGE_TYPES,
    }),
  );
  lastSubscriptionSentAt = Date.now();
}

function scheduleSubscription() {
  if (subscriptionTimer) {
    return;
  }
  const delay = Math.max(0, 1_100 - (Date.now() - lastSubscriptionSentAt));
  subscriptionTimer = setTimeout(() => {
    subscriptionTimer = null;
    sendSubscription();
  }, delay);
}

function connectUpstream() {
  if (upstream || clients.size === 0) {
    return;
  }

  upstream = new WebSocket(AISSTREAM_URL);
  upstreamReady = false;
  upstreamFailed = false;
  broadcastStatus('connecting');
  upstream.on('open', () => {
    sendSubscription();
  });
  upstream.on('message', (data) => {
    let message;
    try {
      message = JSON.parse(data.toString());
    } catch {
      return;
    }

    if (message.MessageType === 'SubscriptionConfirmation') {
      upstreamReady = true;
      reconnectDelay = 1_000;
      broadcastStatus('connected');
      return;
    }
    if (message.MessageType === 'Error' || message.error) {
      upstreamFailed = true;
      broadcastStatus('error', 'AISStream heeft de verbinding geweigerd.');
      return;
    }

    const metadata = message.MetaData;
    const latitude = metadata?.latitude ?? metadata?.Latitude;
    const longitude = metadata?.longitude ?? metadata?.Longitude;

    for (const [client, { bounds }] of clients) {
      const insideBounds =
        typeof latitude !== 'number' ||
        typeof longitude !== 'number' ||
        (latitude >= bounds.southWest.latitude &&
          latitude <= bounds.northEast.latitude &&
          longitude >= bounds.southWest.longitude &&
          longitude <= bounds.northEast.longitude);
      if (insideBounds && client.readyState === WebSocket.OPEN) {
        client.send(data, { binary: false });
      }
    }
  });
  upstream.on('error', (error) => {
    upstreamFailed = true;
    console.error(`AISStream error: ${error.message}`);
    broadcastStatus('error', 'AISStream is tijdelijk niet beschikbaar.');
  });
  upstream.on('close', () => {
    upstream = null;
    upstreamReady = false;
    if (clients.size > 0 && !reconnectTimer) {
      if (!upstreamFailed) {
        broadcastStatus('connecting');
      }
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectUpstream();
      }, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, 30_000);
    }
  });
}

server.on('listening', () => {
  console.log(`AIS relay listening on ws://${host}:${port}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`AIS relay port ${port} is already in use.`);
  } else {
    console.error(`AIS relay could not start: ${error.message}`);
  }
  process.exit(1);
});

server.on('connection', (client, request) => {
  if (!originAllowed(request.headers.origin)) {
    client.close(1008, 'Origin not allowed');
    return;
  }
  if (connectedClients.size >= maximumClients) {
    client.close(1013, 'AIS relay client limit reached');
    return;
  }
  connectedClients.add(client);

  client.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      if (
        message.type !== 'subscribe' ||
        !validBoundingBox(message.boundingBox)
      ) {
        return;
      }
      clients.set(client, { bounds: message.boundingBox });
      sendStatus(client, upstreamReady ? 'connected' : 'connecting');
      if (upstream) {
        scheduleSubscription();
      } else {
        connectUpstream();
      }
    } catch {
      // Invalid client messages are ignored.
    }
  });
  client.on('close', () => {
    connectedClients.delete(client);
    clients.delete(client);
    if (clients.size === 0) {
      clearTimeout(subscriptionTimer);
      subscriptionTimer = null;
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
      upstream?.close();
    } else {
      scheduleSubscription();
    }
  });
});
