import fs from 'node:fs';
import path from 'node:path';

/**
 * Calculates total and message tokens from a transcript usage object.
 * @param {Object} transcript - The transcript object containing usage data.
 * @returns {Object} { total, messages }
 */
export function parseTokens(transcript) {
  if (!transcript || !transcript.usage) return { total: 0, messages: 0 };
  const usage = transcript.usage;
  const total = (usage.input_tokens || 0) + 
                (usage.cache_creation_input_tokens || 0) + 
                (usage.cache_read_input_tokens || 0);
  
  // Fixed overheads
  const SYS_PROMPT = 8800;
  const SYS_TOOLS = 11800;
  const AGENTS = 700;
  const MEMORY = 100;
  const SKILLS = 3600;
  
  const fixed = SYS_PROMPT + SYS_TOOLS + AGENTS + MEMORY + SKILLS;
  const messages = Math.max(0, total - fixed);
  
  return { total, messages };
}

/**
 * Detects "graphify" skill usage and existence of graphify-out/ directory.
 * @param {Object|string} transcript - The transcript history.
 * @param {string} cwd - Current working directory.
 * @returns {boolean}
 */
export function detectGraphify(transcript, cwd) {
  const hasGraphifyDir = fs.existsSync(path.join(cwd, 'graphify-out'));
  if (!hasGraphifyDir) return false;

  const transcriptString = typeof transcript === 'string' 
    ? transcript 
    : JSON.stringify(transcript);
    
  return transcriptString.includes('graphify');
}
