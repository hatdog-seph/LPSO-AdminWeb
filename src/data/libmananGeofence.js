export const LIBMANAN_CENTER = [13.6938, 123.0620];

// south, west, north, east — Libmanan, Camarines Sur
export const LIBMANAN_BOUNDS = {
  south: 13.586267,
  west: 122.796196,
  north: 13.768753,
  east: 123.118907,
};

export function isInsideLibmanan(point) {
  if (!Array.isArray(point) || point.length < 2) return false;

  const lat = Number(point[0]);
  const lng = Number(point[1]);

  return Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= LIBMANAN_BOUNDS.south &&
    lat <= LIBMANAN_BOUNDS.north &&
    lng >= LIBMANAN_BOUNDS.west &&
    lng <= LIBMANAN_BOUNDS.east;
}

export function isValidLibmananPosition(position) {
  return isInsideLibmanan(position);
}
