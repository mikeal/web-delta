import { FileTree, Delta } from '../lib/tree.js'
import { deepEqual as same, ok } from 'assert'
import { randomBytes as rand } from 'crypto'

const fixture = Buffer.from('asdfasdf')

const testBasics = async () => {
  const ftree = await FileTree.fromBytes({ bytes: fixture })
  let bytes = await ftree.read()
  if (!Buffer.from(bytes).equals(fixture)) {
    throw new Error('rendered bytes do not match')
  }

  bytes = Buffer.from(fixture.toString() + '00')
  const dest = await FileTree.fromBytes({ bytes })
  const delta = await ftree.delta(dest)
  const carbytes = await delta.export()

  const result = await ftree.apply(carbytes)
  same(result, bytes)
}

const testBig = async () => {
  let bytes = rand(1024 * 1024)

  const ftree = await FileTree.fromBytes({ bytes })
  const rendered_bytes = await ftree.read()
  for (let i = 0; i < bytes.byteLength; i++) {
    if (rendered_bytes[i] !== bytes[i]) throw new Error('not match ' + i)
  }
  same(rendered_bytes.byteLength, bytes.byteLength)
  same(rendered_bytes, bytes)

  const newbytes = Buffer.from(bytes)
  const i = 1024 * 10
  newbytes[i] = newbytes[i] === 0 ? 1 : newbytes[i] - 1

  const dest = await FileTree.fromBytes({ bytes: newbytes })
  const delta = await ftree.delta(dest)
  const carbytes = await delta.export()
  ok(carbytes.byteLength < 100000)

  const result = await ftree.apply(carbytes)
  same(result, newbytes)
}

const run = async () => {
  await testBasics()
  await testBig()
}
run()
