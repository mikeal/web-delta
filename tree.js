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

const createLeaf = async chunks => {
  const refs = await Promise.all(chunks.map(chunk => chunk.ref()))
  const parts = refs.map(({ cid, size }) => dagPB.createLink('', size, cid))
  return branch(parts)
}
const createBranch = blocks => {
  const parts = blocks.map(block => {
    return dagPB.createLink('', sumparts(block.value.Links), block.cid)
  })
  return branch(parts)
}

// const isBreak = block => block.cid.bytes[block.cid.bytes.byteLength-1] === 0
const getBreaks = blocks => {
  const breaks = []
  for (let i = 0; i < block.length; i++) {
    const { cid: { bytes: { byteLength } } } = block[i]
    if (bytes[byteLength - 1] === 0) breaks.push(i)
  }
}

class FileRef {
  constructor ({ filename, range }) {
    this.filename = filename
    this.range = range
  }
}

class Chunk {
  constructor ({ filename, bytes, range, value, chunkmap}) {
    this.pending = Block.decode({ bytes, codec: raw, hasher }).then(block => {
      this.cid = block.cid
      const key = this.cid.toString()
      chunkmap.set(key, this)
      if (bytes) this._block = block
    })
    this.size = bytes.byteLength
    this.range = range
    this.filename = filename
    this.value = value // this is null when we drop the source bytes
    this.bytes = bytes
    this.isBreak = bytes[bytes.byteLength -1] === 0
  }
  ref () {
    return this.pending.then(() => ({ size: this.size, cid: this.cid }))
  }
  async toBlock () {
    // TODO: handle reloading data when bytes are not there
    await this.pending
    return this._block
  }
}

export class Proof {
  constructor ({ cids, blockmap }) {
    this.cids = cids
    this.blockmap = blockmap
  }
  verify () {
    const deltaset = delta.cids
  }
  static verify (source, dest, getBlock) {
  }
  static fromDelta (delta) {

  }
}

export class Delta {
  constructor({ source, dest, blockmap }) {
    this.source = source
    this.dest = dest
    this.blockmap = blockmap
  }
  static async fromDiff (sourceTree, destTree) {
    const source = source
    const dest = dest
    const cids = new Set([...dest.cids].filter(cid => !source.cids.has(cid)))
    const gb = cid => {
      if (cid.startsWith('dagpb')) {
        return destTree.tree.get(cid) || sourceTree.tree.get(cid)
      } else cid.startsWith('cbor')) {
        const chunk = destTree.chunkmap.get(cid) || sourceTree.chunkmap.get(cid)
        return chunk.toBlock()
      } else {
        throw new Error('unknown cid ' + cid)
      }
    }

    const blockmap new Map(await Promise.all(cids.map.(gb)))

    return new this({ source: sourceTree.root, dest: destTree.root, blockmap })
  }
  proof () {
    return Proof.fromDelta(this)
  }
}

export class FileTree {
  constructor ({ filename, chunkmap, chunks, tree, root }) {
    this.filename = filename
    this.root = root
    this.chunkmap = chunkmap
    this.chunks = chunks
    this.tree = tree
    this.root = root
    this.cids = new Set([...chunkmap.keys(), ...tree.keys() ])
  }
  toByteVector ({ block, range }) {
    if (range) throw new Error('not implemented')
    if (!block) throw new Error('missingblock')
    const vector = [...block.links()].map(([,cid]) => {
      if (cid.code === 113) {
        const block = this.tree.get(cid.toString())
        return this.toByteVector({ block })
      } else if (cid.code === 85) {
        // TODO: support large files w/ dropped bytes
        return this.chunkmap.get(cid.toString()).bytes
      } else {
        throw new Error('unknown codec ' + cid.code)
      }
    })
    return vector
  }
  async readVector (opts={}) {
    if (!opts.block) opts.block = this.tree.get(this.root.toString())
    return Promise.all((await this.toByteVector(opts)).flat())
  }
  async read (opts={}) {
    const vector = await this.readVector(opts)
    return Buffer.concat(vector)
  }
  toByteVectorWithProof ({ range }) {
    throw new Error('unimplemented')
  }
  static async fromFile ({ filename, ...opts }) {
    // TODO: support large file reads that stay within a static memory slab
    const bytes = await fs.readFile(filename)
    return this.fromBytes({ bytes, filename, ...opts })
  }
  static async fromBytes ({ bytes, filename }) {
    const chunkmap = new Map()
    const index = [...cdc(bytes)]
    const chunks = []
    let start = index.shift()
    while (index.length) {
      let end = index.shift()
      chunks.push(new Chunk({
        // TODO: when we support large files we'll drop the bytes here
        bytes: bytes.subarray(start, end),
        range: [ start, end ],
        chunkmap,
        filename
      }))
    }
    let tree = new Map()

    const leaves = []
    let part = []
    let last = -1
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      part.push(chunk)
      if (chunk.isBreak) {
        leaves.push(await createLeaf(part))
        part = []
        last = i
      }
    }
    if (part.length) leaves.push(await createLeaf(part))
    tree = new Map([...tree, ...leaves.map(block => [ block.cid.toString(), block ])])
    
    let branches = leaves
    while (branches.length > 1) {
      const children = []
      let part = []
      let last = -1
      for (let i = 0; i < branches.length; i++) {
        part.push(branches[i])
        if (isBreak(branches[i])) {
          children.push(await createBranch(part))
          part = []
          last = i
        }
      }
      if (part.length) children.push(await createBranch(part))
      tree = new Map([...tree, children.map(block => [ block.cid.toString(), block ])])
      branches = children
    }

    return new this({ tree, chunks, chunkmap, filename, root: branches[0].cid })
  }
  async delta (dest) {
    return Delta.fromDiff({ source, dest })
  }
}

const processChunks = async chunks => {
  const blocks = await Promise.all(
    chunks.map(value => Block.encode({ codec: raw, hasher, value }))
  )
  
  const remaining = blocks.slice(last + 1)
  return { blocks, leaves, remaining }
}



export const stat = async filename => {
  const blockmap = new Map()
  
  const chunks = await readFile(filename)
  let { blocks, leaves, remaining } = await processChunks(chunks)
  leaves = await Promise.all([...leaves, await createLeaf(remaining)])

  while (leaves.length > 1) {
    leaves.forEach(block => blocks.push(block))
    const branches = []
    let part = []
    let last = -1
    for (let i = 0; i < leaves.length; i++) {
      part.push(leaves[i])
      if (isBreak(leaves[i])) {
        branches.push(createBranch(part))
        part = []
        last = i
      }
    }
    const remaining = leaves.slice(last + 1)
    if (remaining.length) {
      branches.push(createBranch(remaining))
    }
    leaves = await Promise.all(branches)
  }

  for (const block of [...blocks, ...leaves]) {
    blockmap.set(block.cid.toString(), block)
  }
  return { blockmap, root: leaves[0].cid }
}


