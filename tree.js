import * as dagPB from '@ipld/dag-pb'
import * as Block from 'multiformats/block'
import * as raw from 'multiformats/codecs/raw'
import { sha256 as hasher } from 'multiformats/hashes/sha2'
import * as fs from 'node:fs/promises'
import { readFileSync } from 'fs'
import { PassThrough } from 'stream'
import { createHash } from 'node:crypto'
import { CarWriter, CarReader } from '@ipld/car'
import { Readable } from 'stream'

import { encodePB } from './vendor/codec.js'
import cdc from './cdc.js'

export const readCar = async carbytes => {
  const car = await CarReader.fromBytes(carbytes)
  const blockmap = new Map()
  for await (const { cid, bytes } of car.blocks()) {
    const codec = cid.code === 112 ? dagPB : raw
    const block = Block.decode({ cid, bytes, codec, hasher })
    blockmap.set(cid.toString(), block)
  }
  const [ root ] = await car.getRoots()
  return { root, blockmap }
}

export const writeCar = async (root, blockmap, output) => {
  const car = await CarWriter.create([root])
  const out = Readable.from(car.out)
  out.pipe(output)
  const hasher = createHash('sha256')
  out.pipe(hasher)
  // sort the blocks by CID to ensure consistency
  for (const key of [...blockmap.keys()].sort()) {
    const block = blockmap.get(key)
    car.writer.put(block)
  }
  await car.writer.close()
  const hash = hasher.digest()
  // TODO: build proper CID
  return hash
}

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

const isBreak = block => {
  if (block.cid.code !== 112) throw new Error('method only for dagpb nodes')
  block.cid.bytes[block.cid.bytes.byteLength-1] === 0
}
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
    const cids = new Set([...destTree.cids].filter(cid => !sourceTree.cids.has(cid)))
    const gb = async cid => {
      if (cid.startsWith('bafy')) {
        return [ cid, destTree.tree.get(cid) || sourceTree.tree.get(cid) ]
      } else if (cid.startsWith('bafk')) {
        const chunk = destTree.chunkmap.get(cid) || sourceTree.chunkmap.get(cid)
        return [ cid, await chunk.toBlock() ]
      } else {
        throw new Error('unknown cid ' + cid)
      }
    }

    const blockmap = new Map(await Promise.all([...cids].map(gb)))

    return new this({ source: sourceTree.root, dest: destTree.root, blockmap })
  }
  proof () {
    return Proof.fromDelta(this)
  }
  async export (output) {
    let buffers
    if (!output) {
      buffers = []
      output = new PassThrough()
      output.on('data', chunk => buffers.push(chunk))
    }
    await writeCar(this.dest, this.blockmap, output)
    if (buffers) {
      return Buffer.concat(buffers)
    }
    return output
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
  getTreeBlock (cid) {
    if (typeof cid !== 'string') cid = cid.toString()
    return this.tree.get(cid)
  }
  getChunkBlock (cid) {
    if (typeof cid !== 'string') cid = cid.toString()
    const chunk = this.chunkmap.get(cid)
    if (!chunk) return null
    return chunk.toBlock()
  }
  getBlock (cid) {
    if (typeof cid === 'string') {
      if (cid.startsWith('bafy')) return this.getTreeBlock(cid)
      else if (cid.startsWith('bafk')) return this.getChunkBlock(cid)
      else throw new Error('Invalid block type')
    }
    if (cid.code === 112) return this.getTreeBlock(cid)
    if (cid.code === 82) return this.getChunkBlock(cid)
    throw new Error('Invalid block type')
  }
  toByteVector ({ block, range }) {
    if (range) throw new Error('not implemented')
    if (!block) throw new Error('missingblock')
    const vector = [...block.links()].map(([,cid]) => {
      if (cid.code === 112) {
        const block = this.tree.get(cid.toString())
        return this.toByteVector({ block })
      } else if (cid.code === 85) {
        // TODO: support large files w/ dropped bytes
        return this.chunkmap.get(cid.toString()).bytes
      } else {
        throw new Error('unknown codec ' + cid.code)
      }
    })
    return vector.flat()
  }
  async readVector (opts={}) {
    if (!opts.block) opts.block = await this.getBlock(this.root)
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
      start = end
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
      tree = new Map([...tree, ...children.map(block => [ block.cid.toString(), block ])])
      branches = children
    }
    const root = branches[0].cid
    if (!tree.get(root.toString())) throw new Error('root missing from map')

    return new this({ tree, chunks, chunkmap, filename, root })
  }
  async delta (dest) {
    return Delta.fromDiff(this, dest)
  }
  async apply (carbytes, output) {
    const { root, blockmap } = await readCar(carbytes)
    let buffers
    let size = 0
    if (!output) {
      buffers = []
      output = new PassThrough()
      output.on('data', chunk => buffers.push(chunk))
    }
    output.on('data', chunk => size += chunk.byteLength)

    const walk = async cid => {
      const scid = cid.toString()
      const block = await ( this.getBlock(scid) || blockmap.get(scid) )
      if (!block) throw new Error('Source file does not have enough origin data to apply delta')
      const links = await Promise.all([...block.links()].map(async ([,link]) => {
        const scid = link.toString()
        const block = await this.getBlock(scid) || blockmap.get(scid)
        if (!block) {
          throw new Error('no block')
        }
        return block
      }))
      for (const block of links) {
        if (block.cid.code === 112) await walk(block.cid)
        else {
          if (block.cid.code !== 85) {
            // not a raw block
            throw new Error('Bad DAG format, source not encoded in Web Delta')
          }
          output.write(block.bytes)
        }
      }
    }
    await walk(root)

    if (buffers) return Buffer.concat(buffers)
    return size
  }
}

const processChunks = async chunks => {
  const blocks = await Promise.all(
    chunks.map(value => Block.encode({ codec: raw, hasher, value }))
  )

  const remaining = blocks.slice(last + 1)
  return { blocks, leaves, remaining }
}

export const delta = async (source, dest) => {
  if (typeof source === 'string') {
    source = readFileSync(source)
  }
  if (typeof dest === 'string') {
    dest = readFileSync(dest)
  }
  source = FileTree.fromBytes({ bytes: source })
  dest = FileTree.fromBytes({ bytes: dest })
  return source.delta(dest)
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


