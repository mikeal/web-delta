import { FileTree } from '../tree.js'

const fixture = Buffer.from('asdfasdf')

const testBasics = async () => {
  const ftree = await FileTree.fromBytes({ bytes: fixture })
  const bytes = await ftree.read()
  console.log({bytes})
  if (!Buffer.from(bytes).equals(fixture)) {
    throw new Error('rendered bytes do not match')
  }
}

testBasics()
