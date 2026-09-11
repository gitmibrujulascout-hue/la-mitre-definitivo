import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export {
  formatDisplayDate,
  toInputDate,
  todayInputDate,
  todayDisplayDate,
  parseDateValue,
} from './dateUtils.js';

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export const isIframe = window.self !== window.top;
