export const PHONE_LAYOUT_MAX_WIDTH = 600;

export function isPhoneLayout(width: number): boolean {
  return width <= PHONE_LAYOUT_MAX_WIDTH;
}
