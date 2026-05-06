'use strict';

const isProd = process.env.NODE_ENV === 'production';

function log(level, msg, meta) {
  const entry = { level, ts: new Date().toISOString(), msg, ...meta };
  if (level === 'error') {
    console.error(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

const logger = {
  info:  (msg, meta) => log('info', msg, meta),
  warn:  (msg, meta) => log('warn', msg, meta),
  error: (msg, err, meta) => log('error', msg, {
    error: err?.message,
    stack: isProd ? undefined : err?.stack,
    ...meta,
  }),
  debug: (msg, meta) => { if (!isProd) log('debug', msg, meta); },
};

module.exports = logger;
