const pad = (value, length) => String(value).padStart(length, '0');

/** Formats milliseconds as "HH:MM:SS . mmm" for the mission clock. */
export function formatMissionTime(elapsedMs) {
  const totalMs = Math.max(0, Math.floor(elapsedMs));
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor(totalMs / 60_000) % 60;
  const seconds = Math.floor(totalMs / 1000) % 60;
  const milliseconds = totalMs % 1000;
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)} . ${pad(milliseconds, 3)}`;
}

/** Formats a speed as "W . DD", matching the seven-segment readout. */
export function formatSpeed(speed) {
  const [whole, decimals] = Math.max(0, speed).toFixed(2).split('.');
  return `${whole} . ${decimals}`;
}
