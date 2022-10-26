import varint from '../vendor/varint.js'
import { CID } from 'multiformats'
import { base32 } from 'multiformats/bases/base32'

const decode_varint = (data, offset = 0) => {
  const code = varint.decode(data, offset)
  return [code, varint.decode.bytes]
}
export const encodeTo = (int, target, offset = 0) => {
  varint.encode(int, target, offset)
  return target
}

const encode = ({ file, options }) => {
  if (!options.min || !options.max || !options.avg || !file) {
    throw new Error('missing required arguments')
  }
  if (!file.bytes) {
    throw new Error('file link does not have a valid byte representation')
  }
  const slab = []
  varint.encode(options.min, slab)
  varint.encode(options.max, slab, slab.length)
  varint.encode(options.avg, slab, slab.length)
  return new Uint8Array([...slab, ...file.bytes])
}
const decode = bytes => {
  bytes = [...bytes]
  let min, max, avg, offset, length
  ;[ min, offset ] = decode_varint(bytes)
  ;[ max, length ] = decode_varint(bytes, offset)
  offset += length
  ;[ avg, length ] = decode_varint(bytes, offset)
  offset += length
  const file = CID.decode(new Uint8Array(bytes.slice(offset)))
  const options = { min, max, avg }
  return { file, options }
}

const code = 5000
const name = 'web-delta'

const inline = bytes => {
  // code prefixed multibase (base32) string
  const slab = []
  varint.encode(code, slab)
  return base32.encode(new Uint8Array([...slab, ...bytes]))
}
const decode_inline = string => {
  if (!string.startsWith('b')) {
    throw new Error('sorry, only supporting base32')
  }
  const decoded = base32.decode(string)
  if (decoded[0] !== 136 || decoded[1] !== 39) {
    throw new Error('invalid inline encoding')
  }
  return decode(decoded.slice(2))
}

export { encode, decode, code, name, inline, decode_inline }
