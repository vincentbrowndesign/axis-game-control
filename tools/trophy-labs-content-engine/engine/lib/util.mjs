import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ESCAPES[character]);
}

export function pad2(value) {
  return String(value).padStart(2, '0');
}

export function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Relative luminance per WCAG 2.1. */
function luminance(hex) {
  const parsed = hex.replace('#', '');
  const channels = [0, 2, 4].map((offset) => parseInt(parsed.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

/** WCAG contrast ratio between two hex colors, rounded to 2 decimals. */
export function contrastRatio(foreground, background) {
  const a = luminance(foreground);
  const b = luminance(background);
  const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  return Math.round(ratio * 100) / 100;
}

export function ok(message) {
  process.stdout.write(`  ok    ${message}\n`);
}

export function info(message) {
  process.stdout.write(`  ..    ${message}\n`);
}

export function warn(message) {
  process.stdout.write(`  warn  ${message}\n`);
}

export function fail(message) {
  process.stdout.write(`  FAIL  ${message}\n`);
}

export function heading(message) {
  process.stdout.write(`\n${message}\n`);
}
