import { FileTree } from './tree.js'
import { walk } from 'fs'

class RemoteTree extends FileTree {
  getBlock () {
    // fetch remote block
    throw new Error('not implemented')
  }
  static async fromRoot (cid) {
    // fetch top of tree from gateway and
    // load all the CIDs (raw included)
    // into memory and instantiate
    throw new Error('not implemented')
    // would be cool if there was a gateway export
    // protocol that did this in one round-trip
  }
}

const CID_LENGTH = 36 // may not be accurate

class FileSystem {
  constructor ({ directory, treemap }) {
    this.directory = directory
    this.treemap = treemap
  }
  static async fromLocalDirectory ({ directory, ...args }) {
    const treemap = new Map()

    throw new Error('not implemented')

    return this({ treemap, directory, ...args })
  }
  static async fromSyncFile ({ directory, sync, ...args }) {
    const treemap = new Map()

    const sep = Buffer.from('\n')[0]
    const split = Buffer.from(':')[0]
    const buffer = []

    let config
    let cursor = 0
    let open = false
    const close = offset => {
      if (cursor === 0) {
        config = JSON.parse(sync.slice(0, offset).toString())
      } else {
        if (offset - cursor < 1) {
          // double newline
        } else {
          if (sync[offset] === split) {
            const key = Buffer.from(sync.slice(cursor, offset))
            const cidbytes = Buffer.from(sync.slice(offset+1, offset+1+CID_LENGTH))
            open = false
            offset = offset + CID_LENGTH
          } else {
            if (!open) {
              open = true
            } else {
              // dont reset cursor
              return offset
            }
          }
        }
      }
      cursor = offset
      return offset
    }

    for (let i = 0; i < sync.byteLength; i++) {
      if (sync[i] === sep || sync[i] === split) {
        i = close(i)
        continue
      }
    }

    await Promise.all([...tree.map.values()])

    // load trees as RemoteTree and instantiate

    return this({ treemap, directory, ...args })
  }
  export () {
    const buffer_list = []
    const sep = Buffer.from('\n')
    const config = Buffer.from(JSON.stringify(this.getConfig()))

    buffer_list.push(config)
    buffer_list.push(sep)
    buffer_list.push(sep)

    for (const [ key, tree ] of this.treemap.entries()) {
      buffer_list.push(Buffer.from(key + ':'))
      buffer_list.push(tree.root.cid.bytes)
      buffer_list.push(sep)
    }

    return Buffer.concat(buffer_list)
  }
}


