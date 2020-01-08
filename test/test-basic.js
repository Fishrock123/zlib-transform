'use strict'

const tap = require('tap')

const zlib = require('zlib')

const FileSource = require('fs-source')
const {
  AssertionSink,
  Stream
} = require('bob-streams')
const ZlibTransform = require('../index.js')

tap.test('test zlib compress', t => {
  t.plan(1)
  const fileSource = new FileSource('./test/fixtures/file')
  const assertionSink = new AssertionSink(
    [
      '1f 8b 08 00 00 00 00 00 00 13', // gzip header
      `73 ce 28 cd cb 56
      c8 cf 4b e5 4a 49 2c 49 54 00 11 5c 5c ce 60 c1
      92 f2 7c 2c 82 19 45 a9 c8 6a 01 de f2 d7 81 40
      00 00 00`, // data roughly as arranged in the .hex file
      ''
    ].map(hex => hex.replace(/[ \n]/g, '')),
    'hex' // encoding
  )

  const zlibTransform = new ZlibTransform({}, zlib.constants.GZIP)

  const stream = new Stream(fileSource, zlibTransform, assertionSink)
  stream.start(error => {
    t.error(error, 'Exit Callback received unexpected error')
    if (error) {
      console.log(error)
    }
    t.end()
  })
})
