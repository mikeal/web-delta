import { CID } from 'multiformats'
import * as codec from '../lib/codec.js'
import { deepEqual as same } from 'assert'

const file = CID.parse('bafybeiaysi4s6lnjev27ln5icwm6tueaw2vdykrtjkwiphwekaywqhcjze')
const options = { min: 1, max: 14000 * 2, avg: 500 }

const test_encoder = () => {
  const encoded = codec.encode({ file, options })
  const decoded = codec.decode(encoded)
  same(decoded, { file, options })
}

const test_inline = () => {
  const encoded = codec.encode({ file, options })
  const inlined = codec.inline(encoded)
  const decoded = codec.decode_inline(inlined)
  same(decoded, { file, options })
}

test_encoder()
test_inline()
