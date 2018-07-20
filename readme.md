# Zlib Transform (BOB)

A zlib transform for the [BOB](https://github.com/Fishrock123/bob) streaming protocol.

## Usage

**Note**: This version currently requires the `--expose-internals` Node.js flag.

```
const ZlibTransform = require('zlib-transform')
new ZlibTransform(options, mode)
```

Implements a [BOB transform](https://github.com/Fishrock123/bob/blob/master/reference-buffered-transform.js) for using zlib compression / decompression.

### Example

```
const zlib = require('zlib')
const ZlibTransform = require('zlib-transform')

const transform = new ZlibTransform({}, zlib.constants.GZIP)
const source = new MyBOBSource()
const sink = new MyBOBSink()

sink.bindSource(transform.bindSource(source), error => {
  if (error)
    console.error('Stream returned error ->', error.stack)
  else {
    console.log('ok')
  }
})
```

See [test-basic](test/test-basic) for a good working example.

## License

[MIT Licensed](license) — _[Contributions via DCO 1.1](contributing.md#developers-certificate-of-origin)_
