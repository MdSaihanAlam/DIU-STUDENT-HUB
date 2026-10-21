const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export function timeAgo(date) {
  if (!date) return '';
  const diff = (new Date(date).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 45) return 'just now';
  const units = [
    ['minute', 60],
    ['hour', 3600],
    ['day', 86400],
    ['week', 604800],
    ['month', 2629800],
    ['year', 31557600],
  ];
  let unit = 'minute';
  let value = diff / 60;
  for (let i = units.length - 1; i >= 0; i--) {
    if (abs >= units[i][1]) {
      unit = units[i][0];
      value = diff / units[i][1];
      break;
    }
  }
  return rtf.format(Math.round(value), unit);
}

export const formatDate = (d, opts = { day: 'numeric', month: 'short', year: 'numeric' }) => (d ? new Date(d).toLocaleDateString('en-GB', opts) : '');

export const formatDateTime = (d) =>
  d ? new Date(d).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';

export const formatTime = (d) => (d ? new Date(d).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' }) : '');

export const formatBDT = (n) => `৳${Number(n || 0).toLocaleString('en-IN')}`;

export function formatBytes(b) {
  if (!b) return '—';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let n = b;
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 && i ? 1 : 0)} ${u[i]}`;
}

export const humanize = (s = '') => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export function daysUntil(d) {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

export function deadlineLabel(d) {
  const n = daysUntil(d);
  if (n === null) return 'Rolling deadline';
  if (n < 0) return 'Closed';
  if (n === 0) return 'Closes today';
  if (n === 1) return 'Closes tomorrow';
  return `${n} days left`;
}

export const initials = (name = '?') =>
  name
    .replace(/\(.*?\)/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase() || '?';

export const toDateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
export const toDateTimeInput = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  const off = dt.getTimezoneOffset();
  return new Date(dt.getTime() - off * 60000).toISOString().slice(0, 16);
};
