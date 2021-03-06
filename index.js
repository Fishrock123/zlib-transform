/* eslint-disable semi, comma-dangle, curly, indent, spaced-comment, no-unused-vars, node/no-deprecated-api, no-self-compare, space-before-function-paren */

'use strict';

// Flags: --expose-internals

const util = require('util')

// const errors = require('internal/errors');
const Transform = require('_stream_transform');
const { _extend } = require('util');
const { isAnyArrayBuffer } = process.binding('util');
// const { isArrayBufferView } = require('internal/util/types');
const binding = process.binding('zlib');
const assert = require('assert').ok;
const {
  Buffer,
  kMaxLength
} = require('buffer');

const status_type = require('bob-status') // eslint-disable-line camelcase

const constants = process.binding('constants').zlib;
const {
  Z_NO_FLUSH, Z_BLOCK, Z_PARTIAL_FLUSH, Z_SYNC_FLUSH, Z_FULL_FLUSH, Z_FINISH,
  Z_MIN_CHUNK, Z_MIN_WINDOWBITS, Z_MAX_WINDOWBITS, Z_MIN_LEVEL, Z_MAX_LEVEL,
  Z_MIN_MEMLEVEL, Z_MAX_MEMLEVEL, Z_DEFAULT_CHUNK, Z_DEFAULT_COMPRESSION,
  Z_DEFAULT_STRATEGY, Z_DEFAULT_WINDOWBITS, Z_DEFAULT_MEMLEVEL, Z_FIXED,
  DEFLATE, DEFLATERAW, INFLATE, INFLATERAW, GZIP, GUNZIP, UNZIP
} = constants;
const { inherits } = require('util');

// translation table for return codes.
const codes = {
  Z_OK: constants.Z_OK,
  Z_STREAM_END: constants.Z_STREAM_END,
  Z_NEED_DICT: constants.Z_NEED_DICT,
  Z_ERRNO: constants.Z_ERRNO,
  Z_STREAM_ERROR: constants.Z_STREAM_ERROR,
  Z_DATA_ERROR: constants.Z_DATA_ERROR,
  Z_MEM_ERROR: constants.Z_MEM_ERROR,
  Z_BUF_ERROR: constants.Z_BUF_ERROR,
  Z_VERSION_ERROR: constants.Z_VERSION_ERROR
};

const ckeys = Object.keys(codes);
for (var ck = 0; ck < ckeys.length; ck++) {
  var ckey = ckeys[ck];
  codes[codes[ckey]] = ckey;
}

// If a flush is scheduled while another flush is still pending, a way to figure
// out which one is the "stronger" flush is needed.
// Roughly, the following holds:
// Z_NO_FLUSH (< Z_TREES) < Z_BLOCK < Z_PARTIAL_FLUSH <
//     Z_SYNC_FLUSH < Z_FULL_FLUSH < Z_FINISH
const flushiness = [];
let i = 0;
for (const flushFlag of [Z_NO_FLUSH, Z_BLOCK, Z_PARTIAL_FLUSH,
                         Z_SYNC_FLUSH, Z_FULL_FLUSH, Z_FINISH]) {
  flushiness[flushFlag] = i++;
}

function maxFlush(a, b) {
  return flushiness[a] > flushiness[b] ? a : b;
}

class ZlibTransform {
  constructor (opts, mode) {
    this.sink = null
    this.source = null

    var chunkSize = Z_DEFAULT_CHUNK;
    var flush = Z_NO_FLUSH;
    var finishFlush = Z_FINISH;
    var windowBits = Z_DEFAULT_WINDOWBITS;
    var level = Z_DEFAULT_COMPRESSION;
    var memLevel = Z_DEFAULT_MEMLEVEL;
    var strategy = Z_DEFAULT_STRATEGY;
    var dictionary;

    if (typeof mode !== 'number')
      throw new /*errors.*/TypeError('ERR_INVALID_ARG_TYPE', 'mode', 'number');
    if (mode < DEFLATE || mode > UNZIP)
      throw new /*errors.*/RangeError('ERR_OUT_OF_RANGE', 'mode');

    if (opts) {
      chunkSize = opts.chunkSize;
      if (chunkSize !== undefined && chunkSize === chunkSize) {
        if (chunkSize < Z_MIN_CHUNK || !Number.isFinite(chunkSize))
          throw new /*errors.*/RangeError('ERR_INVALID_OPT_VALUE',
                                      'chunkSize',
                                      chunkSize);
      } else {
        chunkSize = Z_DEFAULT_CHUNK;
      }

      flush = opts.flush;
      if (flush !== undefined && flush === flush) {
        if (flush < Z_NO_FLUSH || flush > Z_BLOCK || !Number.isFinite(flush))
          throw new /*errors.*/RangeError('ERR_INVALID_OPT_VALUE', 'flush', flush);
      } else {
        flush = Z_NO_FLUSH;
      }

      finishFlush = opts.finishFlush;
      if (finishFlush !== undefined && finishFlush === finishFlush) {
        if (finishFlush < Z_NO_FLUSH || finishFlush > Z_BLOCK ||
            !Number.isFinite(finishFlush)) {
          throw new /*errors.*/RangeError('ERR_INVALID_OPT_VALUE',
                                      'finishFlush',
                                      finishFlush);
        }
      } else {
        finishFlush = Z_FINISH;
      }

      windowBits = opts.windowBits;
      if (windowBits !== undefined && windowBits === windowBits) {
        if (windowBits < Z_MIN_WINDOWBITS || windowBits > Z_MAX_WINDOWBITS ||
            !Number.isFinite(windowBits)) {
          throw new /*errors.*/RangeError('ERR_INVALID_OPT_VALUE',
                                      'windowBits',
                                      windowBits);
        }
      } else {
        windowBits = Z_DEFAULT_WINDOWBITS;
      }

      level = opts.level;
      if (level !== undefined && level === level) {
        if (level < Z_MIN_LEVEL || level > Z_MAX_LEVEL ||
            !Number.isFinite(level)) {
          throw new /*errors.*/RangeError('ERR_INVALID_OPT_VALUE',
                                      'level', level);
        }
      } else {
        level = Z_DEFAULT_COMPRESSION;
      }

      memLevel = opts.memLevel;
      if (memLevel !== undefined && memLevel === memLevel) {
        if (memLevel < Z_MIN_MEMLEVEL || memLevel > Z_MAX_MEMLEVEL ||
            !Number.isFinite(memLevel)) {
          throw new /*errors.*/RangeError('ERR_INVALID_OPT_VALUE',
                                      'memLevel', memLevel);
        }
      } else {
        memLevel = Z_DEFAULT_MEMLEVEL;
      }

      strategy = opts.strategy;
      if (strategy !== undefined && strategy === strategy) {
        if (strategy < Z_DEFAULT_STRATEGY || strategy > Z_FIXED ||
            !Number.isFinite(strategy)) {
          throw new /*errors.*/TypeError('ERR_INVALID_OPT_VALUE',
                                     'strategy', strategy);
        }
      } else {
        strategy = Z_DEFAULT_STRATEGY;
      }

      dictionary = opts.dictionary;
      // if (dictionary !== undefined && !isArrayBufferView(dictionary)) {
      //   if (isAnyArrayBuffer(dictionary)) {
      //     dictionary = Buffer.from(dictionary);
      //   } else {
      //     throw new errors.TypeError('ERR_INVALID_OPT_VALUE',
      //                                'dictionary',
      //                                dictionary);
      //   }
      // }
    }

    this._handle = new binding.Zlib(mode);
    this._handle.jsref = this; // Used by processCallback() and zlibOnError()
    this._handle.onerror = zlibOnError;
    this._hadError = false;
    this._writeState = new Uint32Array(2);

    if (!this._handle.init(windowBits,
                           level,
                           memLevel,
                           strategy,
                           this._writeState,
                           processCallback,
                           dictionary)) {
      throw new /*errors.*/Error('ERR_ZLIB_INITIALIZATION_FAILED');
    }

    this._outBuffer = Buffer.allocUnsafe(chunkSize);
    this._outOffset = 0;
    this._level = level;
    this._strategy = strategy;
    this._chunkSize = chunkSize;
    this._flushFlag = flush;
    this._scheduledFlushFlag = Z_NO_FLUSH;
    this._origFlushFlag = flush;
    this._finishFlushFlag = finishFlush;
    this._info = opts && opts.info;

    // The streams+ state
    this._ended = false
    this._pullFromHandle = false
    this._pullSize = opts.hwm || 1024 * 16
  }

  bindSource (source) {
    source.bindSink(this)
    this.source = source

    return this
  }

  bindSink (sink) {
    this.sink = sink
  }

  close () {
    _close(this)
  }

  get _closed () {
    return !this._handle
  }

  next (status, error, buffer, bytes) {
    if (error !== null) {
      this.close()
      return this.sink.next(status, error, Buffer.alloc(0), 0)
    }
    if (status === status_type.end) {
      this._ended = true
    }
    if (buffer === null) buffer = Buffer.alloc(0)
    if (bytes < 0) bytes = 0

    // If it's the last chunk, or a final flush, we use the Z_FINISH flush flag
    // (or whatever flag was provided using opts.finishFlush).
    // If it's explicitly flushing at some other time, then we use
    // Z_FULL_FLUSH. Otherwise, use the original opts.flush flag.
    var flushFlag;
    var ws = {} //this._writableState;
    // if ((ws.ending || ws.ended) && ws.length === chunk.byteLength) {
    if (status === status_type.end) {
      // XXX: Should be on status_type.end message?
      flushFlag = this._finishFlushFlag;
    } else {
      flushFlag = this._flushFlag;
      // once we've flushed the last of the queue, stop flushing and
      // go back to the normal behavior.
      // if (chunk.byteLength >= ws.length)
      //   this._flushFlag = this._origFlushFlag;
    }

    var handle = this._handle;
    if (!handle) {
      this.close()
      return this.sink.next(status, new /*errors.*/Error('ERR_ZLIB_BINDING_CLOSED'), Buffer.alloc(0), 0)
    }

    const cb = (error, pullMore) => {
      if (error) {
        this.close()
        return this.sink.next(status, error, Buffer.alloc(0), 0)
      }

      if (status === status_type.end) return

      if (pullMore) this.source.pull(null, Buffer.alloc(this._pullSize))
    }

    const chunk = buffer.slice(0, bytes)

    handle.buffer = chunk;
    handle.cb = cb;
    handle.availOutBefore = this._chunkSize - this._outOffset;
    handle.availInBefore = chunk.length;
    handle.inOff = 0;
    handle.flushFlag = flushFlag;

    handle.write(flushFlag,
                 chunk, // in
                 0, // in_off
                 handle.availInBefore, // in_len
                 this._outBuffer, // out
                 this._outOffset, // out_off
                 handle.availOutBefore); // out_len
  }

  pull (error, buffer) {
    if (this._pullFromHandle) {
      var handle = this._handle;
      if (!handle) {
        this.close()
        return this.sink.next(status_type.error, new /*errors.*/Error('ERR_ZLIB_BINDING_CLOSED'), Buffer.alloc(0), 0)
      }

      return handle.write(handle.flushFlag,
                          handle.buffer, // in
                          handle.inOff, // in_off
                          handle.availInBefore, // in_len
                          this._outBuffer, // out
                          this._outOffset, // out_off
                          this._chunkSize); // out_len
    }

    if (this._ended) {
      this.sink.next(status_type.end, null, Buffer.alloc(0), 0)
      return
    }

    return this.source.pull(error, buffer || Buffer.alloc(this._pullSize))
  }
}

function zlibOnError(message, errno) {
  var self = this.jsref;
  // there is no way to cleanly recover.
  // continuing only obscures problems.
  _close(self);
  self._hadError = true;

  const error = new Error(message);
  error.errno = errno;
  error.code = codes[errno];

  // Propogate the error up
  self.source.pull(error, Buffer.alloc(0))
}

function _close(engine, callback) {
  // Caller may invoke .close after a zlib error (which will null _handle).

  if (!engine._handle)
    return;

  engine._handle.close();
  engine._handle = null;
}

function processCallback() {
  // This callback's context (`this`) is the `_handle` (ZCtx) object. It is
  // important to null out the values once they are no longer needed since
  // `_handle` can stay in memory long after the buffer is needed.
  var handle = this;
  var self = this.jsref;
  var state = self._writeState;

  var pullMore = true

  if (self._hadError) {
    this.buffer = null;
    return;
  }

  if (self.destroyed) {
    this.buffer = null;
    return;
  }

  var availOutAfter = state[0];
  var availInAfter = state[1];

  var inDelta = (handle.availInBefore - availInAfter);

  var have = handle.availOutBefore - availOutAfter;
  if (have > 0) {
    var out = self._outBuffer.slice(self._outOffset, self._outOffset + have);
    self._outOffset += have;

    pullMore = false

    self.sink.next(status_type.continue, null, out, out.length)
  } else if (have < 0) {
    assert(false, 'have should not go down');
  }

  // exhausted the output buffer, or used all the input create a new one.
  if (availOutAfter === 0 || self._outOffset >= self._chunkSize) {
    handle.availOutBefore = self._chunkSize;
    self._outOffset = 0;
    self._outBuffer = Buffer.allocUnsafe(self._chunkSize);
  }

  self._pullFromHandle = false

  if (availOutAfter === 0) {
    // Not actually done. Need to reprocess.
    // Also, update the availInBefore to the availInAfter value,
    // so that if we have to hit it a third (fourth, etc.) time,
    // it'll have the correct byte counts.
    handle.inOff += inDelta;
    handle.availInBefore = availInAfter;

    self._pullFromHandle = true

    if (have === 0) {
      self.sink.next(status_type.continue, null, Buffer.alloc(0), 0)
    }

    return;
  }

  // finished with the chunk.
  this.buffer = null;
  this.cb(null, pullMore);
}

module.exports = ZlibTransform
