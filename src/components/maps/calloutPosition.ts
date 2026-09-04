import type { MapPressPoint } from './BaseMap.types';

const CARD_MAX_WIDTH = 320;
const DEFAULT_CARD_HEIGHT = 190;
const SCREEN_MARGIN = 12;
const POINTER_HEIGHT = 10;
const POINTER_GAP = 7;

export function getCalloutPosition(
  point: MapPressPoint,
  screenWidth: number,
  screenHeight: number,
  safeTop: number,
  safeBottom: number,
  cardHeight = DEFAULT_CARD_HEIGHT,
) {
  const width = Math.min(CARD_MAX_WIDTH, screenWidth - SCREEN_MARGIN * 2);
  const minTop = safeTop + SCREEN_MARGIN;
  const maxTop = Math.max(
    minTop,
    screenHeight - safeBottom - cardHeight - POINTER_HEIGHT - SCREEN_MARGIN,
  );
  const above = point.y - cardHeight - POINTER_HEIGHT - POINTER_GAP >= minTop;
  const desiredTop = above
    ? point.y - cardHeight - POINTER_HEIGHT - POINTER_GAP
    : point.y + POINTER_GAP;
  const left = Math.max(
    SCREEN_MARGIN,
    Math.min(point.x - width / 2, screenWidth - width - SCREEN_MARGIN),
  );

  return {
    above,
    arrowLeft: Math.max(22, Math.min(point.x - left - 8, width - 38)),
    left,
    top: Math.max(minTop, Math.min(desiredTop, maxTop)),
    width,
  };
}
