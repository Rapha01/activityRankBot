import { access, constants as FS } from 'node:fs/promises';
import { resolve } from 'node:path';

export interface CommonConfigFlags {
  configPath: string;
  keysPath: string;
}

export const COMMON_CONFIG_FLAGS = {
  configPath: {
    kind: 'parsed',
    parse: tryFilePath,
    default: 'config/config.json',
    brief: 'The path to a config.json file.',
  },
  keysPath: {
    kind: 'parsed',
    parse: tryFilePath,
    default: 'config/keys.json',
    brief: 'The path to a keys.json file.',
  },
} as const;

async function tryFilePath(path: string) {
  // Techinically, this could introduce a race condition
  // where the file is modified or deleted before being read.
  // I think the benefits of cleanly testing the flags here outweigh
  // the unlikelihood of the race condition.
  const absPath = resolve(path);
  try {
    await access(absPath, FS.R_OK);
    return absPath;
  } catch {
    throw `cannot read configuration file at '${absPath}'.`;
  }
}
