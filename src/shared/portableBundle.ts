import { BugReport } from './types';
import { reviewedSession } from './evidenceReview';
import { generateFilenameStem, generateMarkdownReport } from '../editor/exportUtils';

const encoder = new TextEncoder();
const crc32 = (bytes: Uint8Array) => { let crc = 0xffffffff; for (const byte of bytes) { crc ^= byte; for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ 0xffffffff) >>> 0; };
const u16 = (n: number) => [n & 255, (n >>> 8) & 255]; const u32 = (n: number) => [...u16(n), ...u16(n >>> 16)];

/** Creates a local, uncompressed ZIP with safe fixed filenames. */
export function createPortableBundle(report: BugReport): Blob {
  const stem = generateFilenameStem(report.title, report.metadata.capturedAt);
  const reviewed = report.debugSession ? reviewedSession(report.debugSession) : undefined;
  const files = [
    [`${stem}.md`, generateMarkdownReport({ ...report, debugSession: reviewed }, stem)],
    ['diagnostics.json', JSON.stringify({ console: reviewed?.consoleEvents || [], network: reviewed?.networkEvents || [], limitations: ['No request/response bodies or DevTools-console transcript.'] }, null, 2)],
    ['manifest.json', JSON.stringify({ version: 1, report: `${stem}.md`, diagnostics: 'diagnostics.json', screenshotIncluded: Boolean(report.annotatedScreenshotDataUrl || report.screenshotDataUrl) }, null, 2)],
  ] as const;
  const chunks: number[] = []; const directory: number[] = []; let offset = 0;
  for (const [name, content] of files) { const filename = encoder.encode(name); const data = encoder.encode(content); const crc = crc32(data); const local = [80,75,3,4,20,0,0,0,0,0,0,0,0,0,...u32(crc),...u32(data.length),...u32(data.length),...u16(filename.length),0,0,...filename,...data]; chunks.push(...local); directory.push(80,75,1,2,20,0,20,0,0,0,0,0,0,0,...u32(crc),...u32(data.length),...u32(data.length),...u16(filename.length),0,0,0,0,0,0,0,0,...u32(offset),...filename); offset += local.length; }
  const directoryOffset = chunks.length; chunks.push(...directory,80,75,5,6,0,0,0,0,...u16(files.length),...u16(files.length),...u32(directory.length),...u32(directoryOffset),0,0);
  return new Blob([new Uint8Array(chunks)], { type: 'application/zip' });
}
