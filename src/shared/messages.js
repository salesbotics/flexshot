/** Shared message types between popup, SW, content, editor */

export const MSG = {
  CAPTURE_VISIBLE: 'CAPTURE_VISIBLE',
  CAPTURE_REGION: 'CAPTURE_REGION',
  CAPTURE_FULLPAGE: 'CAPTURE_FULLPAGE',
  REGION_START: 'REGION_START',
  REGION_RESULT: 'REGION_RESULT',
  REGION_CANCEL: 'REGION_CANCEL',
  FULLPAGE_CAPTURE: 'FULLPAGE_CAPTURE',
  FULLPAGE_PROGRESS: 'FULLPAGE_PROGRESS',
  OPEN_EDITOR: 'OPEN_EDITOR',
  STORE_IMAGE: 'STORE_IMAGE',
  GET_IMAGE: 'GET_IMAGE',
  START_RECORD: 'START_RECORD',
  STOP_RECORD: 'STOP_RECORD',
  RECORD_STATUS: 'RECORD_STATUS',
  EXPORT_PDF: 'EXPORT_PDF',
  DOWNLOAD: 'DOWNLOAD',
  PING: 'PING'
};

export function stampFilename(prefix, ext) {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const name = `${prefix}_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `${name}.${ext}`;
}
