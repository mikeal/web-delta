import { FileTree } from '../tree.js'

const fixture = Buffer.from('asdfasdf')

const testBasics = async () => {
  const ftree = await FileTree.fromBytes({ bytes: fixture })
  let bytes = await ftree.read()
  if (!Buffer.from(bytes).equals(fixture)) {
    throw new Error('rendered bytes do not match')
  }
  
  bytes = Buffer.from(fixture.toString() + '00')
  const dest = await FileTree.fromBytes({ bytes })
  const delta = ftree.delta(dest)

}

testBasics()
