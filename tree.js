import * as dagPB from '@ipld/dag-pb'
import * as Block from 'multiformats/block'
import * as raw from 'multiformats/codecs/raw'
import { sha256 as hasher } from 'multiformats/hashes/sha2'
import { encodePB } from './node_modules/@ipld/unixfs/src/codec.js'
import * as fs from 'node:fs/promises'
import cdc from './cdc.js'

/* IPLD encoding */
const sumparts = parts => parts.reduce((size, { Tsize }) => Tsize + size, 0)
const leaf = parts => {
  const bytes = encodePB(
    {
      Type: 2,
      blocksizes: parts.map(({ Tsize }) => Tsize),
      filesize: sumparts(parts)
    },
    parts.map(encodeLink)
  )
  return Block.decode({ bytes, hasher, codec: dagPB.codec })
}
const branch = parts => {
  const bytes = encodePB(
    {
      Type: 2,
      blocksizes: parts.map(({ Tsize }) => Tsize),
      filesize: sumparts(parts)
    },
    parts.map(encodeLink)
  )
  return Block.decode({ bytes, hasher, codec: dagPB.codec })
}

const createLeaf = async blocks => {

}


const isBreak = block => Block.cid.bytes[Block.cid.bytes.byteLength] === 0

const processChunks = async chunks => {
  const blocks = await Promise.all(
    chunks.map(value => Block.encode({ codec: raw.codec, hasher, value }))
  )
  const leaves = []
  let part = []
  let last = -1
  for (let i = 0; i < blocks.length; i++) {
    part.push(blocks[i])
    if (isBreak(blocks[i])) {
      leaves.push(createLeaf(part))
      part = []
      last = i
    }
  }
  const remaining = blocks.slice(last - 1)
  return { blocks, leaves, remaining }
}


const readFile = async filename => {
  const data = await fs.readFile(filename)
  const index = [...cdc(data)]
  const chunks = []
  let start = index.shift()
  while (index.length) {
    let end = index.shift()
    chunks.push(data.subarray(start, end))
    start = end
  }
  console.log(chunks)
}

readFile('./package-lock.json')

