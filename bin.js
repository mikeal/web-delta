#!/usr/bin/env node

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { stat } from './tree.js'
import { createHash } from 'node:crypto'
import { CarWriter } from '@ipld/car'
import { Readable } from 'stream'

const options = () => {}

const writeCar = async (root, blockmap, output) => {
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

yargs(hideBin(process.argv))
  .command('stat <file>', 'Prints file encode info', options, async (argv) => {
    const { root } = await stat(argv.file)
    console.log(root.toString())
  })
  .command('export <file>', 'Exports a CAR of the entire file for IPFS.', options, async argv => {
    const { root, blockmap } = await stat(argv.file)
    const cid = await writeCar(root, blockmap, process.stdout)
  })
  .demandCommand(1)
  .parse()

