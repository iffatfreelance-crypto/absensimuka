/**
 * Utility formatters for date, time, and numbers
 */

/**
 * Format attendance time string (e.g. "07:53:27.691431", "07:53:27", "2026-10-22T07:53:27Z")
 * to clean "HH:mm" (hours and minutes only, no seconds or microseconds).
 */
export function formatTimeHM(timeVal?: string | Date | null): string {
  if (!timeVal) return '--:--';

  if (typeof timeVal === 'string') {
    // If ISO date string e.g. 2026-10-22T07:53:27.123Z
    if (timeVal.includes('T')) {
      const d = new Date(timeVal);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }).replace('.', ':');
      }
    }

    // If TIME string e.g. 07:53:27.691431, 07:53:27, 07:53
    const colonParts = timeVal.split(':');
    if (colonParts.length >= 2) {
      const hh = colonParts[0].trim().padStart(2, '0');
      // In case minutes has a dot or extra characters, slice first 2
      const mm = colonParts[1].trim().slice(0, 2).padStart(2, '0');
      return `${hh}:${mm}`;
    }

    // In case string uses dot notation like 07.53.27
    const dotParts = timeVal.split('.');
    if (dotParts.length >= 2 && dotParts[0].length <= 2) {
      const hh = dotParts[0].trim().padStart(2, '0');
      const mm = dotParts[1].trim().slice(0, 2).padStart(2, '0');
      return `${hh}:${mm}`;
    }
  }

  if (timeVal instanceof Date && !isNaN(timeVal.getTime())) {
    return timeVal.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }).replace('.', ':');
  }

  return String(timeVal);
}
