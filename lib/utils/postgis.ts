/**
 * Helper to decode PostGIS WKB (hex) or EWKB to [lng, lat]
 */
export const decodePostGISPoint = (locationData: string | any): { lng: number, lat: number } | null => {
  if (!locationData) return null;
  
  // Handle GeoJSON-style object if returned by Supabase
  if (typeof locationData === 'object' && locationData.coordinates) {
    return { lng: locationData.coordinates[0], lat: locationData.coordinates[1] };
  }

  if (typeof locationData !== 'string') return null;

  // Handle standard "POINT(lng lat)" text format
  if (locationData.startsWith('POINT')) {
    const match = locationData.match(/POINT\((.+) (.+)\)/);
    if (match) return { lng: parseFloat(match[1]), lat: parseFloat(match[2]) };
  }

  // Handle WKB (hex string)
  try {
    const isEWKB = locationData.includes("0101000020");
    const offset = isEWKB ? 18 : 10;
    
    const hexToBytes = (h: string) => {
      const bytes = new Uint8Array(h.length / 2);
      for (let i = 0; i < h.length; i += 2) {
        bytes[i / 2] = parseInt(h.substring(i, i + 2), 16);
      }
      return bytes;
    };

    const bytes = hexToBytes(locationData);
    const view = new DataView(bytes.buffer);
    const lng = view.getFloat64(offset / 2, true);
    const lat = view.getFloat64((offset / 2) + 8, true);
    
    return { lng, lat };
  } catch (e) {
    return null;
  }
};
