import { TransformStream } from "@web-std/stream"
import * as UnixFS from "@ipld/unixfs"
import fastcdc from 'fastcdc-wasm'

const avg = 16384

const minChunkSize = avg / 4
const maxChunkSize = avg * 8
const avgChunkSize = avg

const cdc = buffer => fastcdc.get_chunks(buffer, minChunkSize, avgChunkSize, maxChunkSize)

export default cdc
