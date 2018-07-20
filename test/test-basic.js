'use strict'

const zlib = require('zlib')

const FileSource = require('fs-source')
const AssertionSink = require('./assertion-helper-sink')
const ZlibTransform = require('../index.js')

const fileSource = new FileSource('./test/fixtures/file')
const assertionSink = new AssertionSink(
  [
    '1f 8b 08 00 00 00 00 00 00 13', // gzip header
    `73 ce 28 cd cb 56
     c8 cf 4b e5 4a 49 2c 49 54 00 11 5c 5c ce 60 c1
     92 f2 7c 2c 82 19 45 a9 c8 6a 01 de f2 d7 81 40
     00 00 00`, // data roughly as arranged in the .hex file
  ].map(hex => hex.replace(/[ \n]/g, '')),
  'hex' // encoding
)

const zlibTransform = new ZlibTransform({}, zlib.constants.GZIP)

assertionSink.bindSource(zlibTransform.bindSource(fileSource), error => {
  if (error)
    console.error('Stream returned ->', error.stack)
  else {
    console.log('ok')
  }
})
