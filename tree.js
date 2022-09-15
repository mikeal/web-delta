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
    parts
  )
  return Block.decode({ bytes, hasher, codec: dagPB })
}
const branch = parts => {
  const bytes = encodePB(
    {
      Type: 2,
      blocksizes: parts.map(({ Tsize }) => Tsize),
      filesize: sumparts(parts)
    },
    parts
  )
  return Block.decode({ bytes, hasher, codec: dagPB })
}

const createLeaf = blocks => {
  const parts = blocks.map(block => dagPB.createLink('', block.value.byteLength, block.cid))
  return branch(parts)
}


const isBreak = block => block.cid.bytes[block.cid.bytes.byteLength] === 0

const processChunks = async chunks => {
  const blocks = await Promise.all(
    chunks.map(value => Block.encode({ codec: raw, hasher, value }))
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
  return chunks
}

export const stat = async filename => {
  const blockmap = new Map()
  
  const chunks = await readFile(filename)
  let { blocks, leaves, remaining } = await processChunks(chunks)
  leaves = await Promise.all([...leaves, createLeaf(remaining)])

  if (leaves.length > 1) {
    throw new Error('Not implemented: top of tree')
  }

  for (const block of [...blocks, ...leaves]) {
    blockmap.set(block.cid.toString(), block)
  }
  return { blockmap, root: leaves[0].cid }
}


