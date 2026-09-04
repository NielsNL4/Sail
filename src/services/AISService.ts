import type {
  AISBoundingBox,
  AISConnectionStatus,
  AISVessel,
  VesselDimensions,
} from '@/types';

type VesselListener = (vessel: AISVessel) => void;
type StatusListener = (
  status: AISConnectionStatus,
  error: string | null,
) => void;

interface WebSocketLike {
  readyState: number;
  close: () => void;
  send: (data: string) => void;
  onopen: (() => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
}

type WebSocketFactory = (url: string) => WebSocketLike;

export interface AISService {
  connect: (boundingBox: AISBoundingBox) => void;
  disconnect: () => void;
  onVesselUpdate: (listener: VesselListener) => () => void;
  onStatusChange: (listener: StatusListener) => () => void;
}

interface StaticVesselData {
  name: string | null;
  shipType: number | null;
  dimensions: VesselDimensions | null;
}

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function cleanName(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const name = value.replace(/@+$/g, '').trim();
  return name.length > 0 ? name : null;
}

function readDimensions(value: unknown): VesselDimensions | null {
  if (!isRecord(value)) {
    return null;
  }

  const a = finiteNumber(value.A);
  const b = finiteNumber(value.B);
  const c = finiteNumber(value.C);
  const d = finiteNumber(value.D);
  const lengthMeters = a !== null && b !== null ? a + b : null;
  const widthMeters = c !== null && d !== null ? c + d : null;

  return lengthMeters !== null || widthMeters !== null
    ? { lengthMeters, widthMeters }
    : null;
}

function readStaticData(
  messageType: string,
  message: Record<string, unknown>,
  metadata: Record<string, unknown>,
): StaticVesselData | null {
  const body = isRecord(message[messageType]) ? message[messageType] : null;

  if (!body) {
    return null;
  }

  const reportA = isRecord(body.ReportA) ? body.ReportA : null;
  const reportB = isRecord(body.ReportB) ? body.ReportB : null;
  const name =
    cleanName(body.Name) ??
    cleanName(reportA?.Name) ??
    cleanName(metadata.ShipName);
  const shipType = finiteNumber(body.Type) ?? finiteNumber(reportB?.ShipType);
  const dimensions =
    readDimensions(body.Dimension) ?? readDimensions(reportB?.Dimension);

  if (name === null && shipType === null && dimensions === null) {
    return null;
  }

  return { name, shipType, dimensions };
}

export function normalizeAISMessage(
  payload: unknown,
  staticData: StaticVesselData | null = null,
  receivedAt = new Date().toISOString(),
): AISVessel | null {
  if (!isRecord(payload) || !isRecord(payload.MetaData)) {
    return null;
  }

  const messageType =
    typeof payload.MessageType === 'string' ? payload.MessageType : null;
  const message = isRecord(payload.Message) ? payload.Message : null;
  const body =
    messageType && message && isRecord(message[messageType])
      ? message[messageType]
      : null;

  if (
    !messageType ||
    !body ||
    ![
      'PositionReport',
      'StandardClassBPositionReport',
      'ExtendedClassBPositionReport',
    ].includes(messageType)
  ) {
    return null;
  }

  const latitude =
    finiteNumber(payload.MetaData.latitude) ??
    finiteNumber(payload.MetaData.Latitude);
  const longitude =
    finiteNumber(payload.MetaData.longitude) ??
    finiteNumber(payload.MetaData.Longitude);
  const mmsiValue = payload.MetaData.MMSI;

  if (
    latitude === null ||
    longitude === null ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180 ||
    body.Valid === false ||
    (typeof mmsiValue !== 'number' && typeof mmsiValue !== 'string')
  ) {
    return null;
  }

  const speed = finiteNumber(body.Sog);
  const course = finiteNumber(body.Cog);
  const heading = finiteNumber(body.TrueHeading);
  const inlineStatic = readStaticData(
    messageType,
    message ?? {},
    payload.MetaData,
  );

  return {
    mmsi: String(mmsiValue),
    name:
      inlineStatic?.name ??
      cleanName(payload.MetaData.ShipName) ??
      staticData?.name ??
      null,
    coordinates: { latitude, longitude },
    speedKnots: speed !== null && speed >= 0 && speed < 102.3 ? speed : null,
    courseDegrees:
      course !== null && course >= 0 && course < 360 ? course : null,
    headingDegrees:
      heading !== null && heading >= 0 && heading < 360 ? heading : null,
    shipType: inlineStatic?.shipType ?? staticData?.shipType ?? null,
    dimensions: inlineStatic?.dimensions ?? staticData?.dimensions ?? null,
    lastUpdate: receivedAt,
  };
}

async function messageDataToText(data: unknown): Promise<string | null> {
  if (typeof data === 'string') {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return new TextDecoder().decode(data);
  }
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    return data.text();
  }
  return null;
}

export function createAISService(
  relayUrl = process.env.EXPO_PUBLIC_AIS_RELAY_URL,
  socketFactory?: WebSocketFactory,
): AISService {
  let socket: WebSocketLike | null = null;
  let boundingBox: AISBoundingBox | null = null;
  let shouldConnect = false;
  let reconnectAttempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  const vesselListeners = new Set<VesselListener>();
  const statusListeners = new Set<StatusListener>();
  const staticByMmsi = new Map<string, StaticVesselData>();

  const emitStatus = (status: AISConnectionStatus, error: string | null) => {
    statusListeners.forEach((listener) => listener(status, error));
  };

  const sendSubscription = () => {
    if (socket?.readyState === 1 && boundingBox) {
      socket.send(JSON.stringify({ type: 'subscribe', boundingBox }));
    }
  };

  const scheduleReconnect = () => {
    if (!shouldConnect || reconnectTimer) {
      return;
    }

    const delay = Math.min(
      RECONNECT_BASE_MS * 2 ** reconnectAttempt,
      RECONNECT_MAX_MS,
    );
    reconnectAttempt += 1;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      openSocket();
    }, delay);
  };

  const handlePayload = (payload: unknown) => {
    if (isRecord(payload) && payload.type === 'status') {
      const status = payload.status;
      if (
        status === 'connecting' ||
        status === 'connected' ||
        status === 'error'
      ) {
        if (status === 'connected') {
          reconnectAttempt = 0;
        }
        emitStatus(
          status,
          typeof payload.error === 'string' ? payload.error : null,
        );
      }
      return;
    }

    if (!isRecord(payload) || !isRecord(payload.MetaData)) {
      return;
    }

    const mmsiValue = payload.MetaData.MMSI;
    const mmsi =
      typeof mmsiValue === 'number' || typeof mmsiValue === 'string'
        ? String(mmsiValue)
        : null;
    const messageType =
      typeof payload.MessageType === 'string' ? payload.MessageType : '';
    const message = isRecord(payload.Message) ? payload.Message : {};

    if (
      mmsi &&
      (messageType === 'ShipStaticData' || messageType === 'StaticDataReport')
    ) {
      const nextStatic = readStaticData(messageType, message, payload.MetaData);
      if (nextStatic) {
        staticByMmsi.set(mmsi, {
          name: nextStatic.name ?? staticByMmsi.get(mmsi)?.name ?? null,
          shipType:
            nextStatic.shipType ?? staticByMmsi.get(mmsi)?.shipType ?? null,
          dimensions:
            nextStatic.dimensions ?? staticByMmsi.get(mmsi)?.dimensions ?? null,
        });
      }
      return;
    }

    const vessel = normalizeAISMessage(
      payload,
      mmsi ? (staticByMmsi.get(mmsi) ?? null) : null,
    );
    if (vessel) {
      vesselListeners.forEach((listener) => listener(vessel));
    }
  };

  const openSocket = () => {
    if (!shouldConnect || !boundingBox || socket) {
      return;
    }
    if (!relayUrl) {
      emitStatus('error', 'AIS-relay URL ontbreekt.');
      return;
    }

    emitStatus('connecting', null);
    const factory =
      socketFactory ?? ((url: string) => new WebSocket(url) as WebSocketLike);

    try {
      socket = factory(relayUrl);
    } catch {
      socket = null;
      emitStatus('error', 'AIS-verbinding kon niet worden gestart.');
      scheduleReconnect();
      return;
    }

    const activeSocket = socket;
    activeSocket.onopen = () => {
      if (socket !== activeSocket) {
        return;
      }
      sendSubscription();
    };
    activeSocket.onmessage = ({ data }) => {
      if (socket !== activeSocket) {
        return;
      }
      void messageDataToText(data).then((text) => {
        if (!text || socket !== activeSocket) {
          return;
        }
        try {
          handlePayload(JSON.parse(text));
        } catch {
          // Malformed provider messages are ignored without dropping the stream.
        }
      });
    };
    activeSocket.onerror = () => {
      if (socket !== activeSocket) {
        return;
      }
      emitStatus('error', 'AIS-verbinding is tijdelijk niet beschikbaar.');
    };
    activeSocket.onclose = () => {
      if (socket !== activeSocket) {
        return;
      }
      socket = null;
      if (shouldConnect) {
        emitStatus('connecting', null);
        scheduleReconnect();
      } else {
        emitStatus('disconnected', null);
      }
    };
  };

  return {
    connect(nextBoundingBox) {
      boundingBox = nextBoundingBox;
      shouldConnect = true;
      if (socket) {
        sendSubscription();
      } else {
        openSocket();
      }
    },
    disconnect() {
      shouldConnect = false;
      boundingBox = null;
      staticByMmsi.clear();
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      const activeSocket = socket;
      socket = null;
      activeSocket?.close();
      emitStatus('disconnected', null);
    },
    onVesselUpdate(listener) {
      vesselListeners.add(listener);
      return () => vesselListeners.delete(listener);
    },
    onStatusChange(listener) {
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    },
  };
}

export const aisService = createAISService();
