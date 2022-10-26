#!/usr/bin/env node

import yargs from 'yargs'
import { readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { hideBin } from 'yargs/helpers'
import { stat as treeStat, FileTree, writeCar } from '../lib/tree.js'
import { createClient } from '@web3-storage/w3up-client'
import w3up from './w3up-sub.js'

const car_default_outfile = '${cid}.car'

const carcid = () => 'replace_me'

const outfile_options = (argv, default_outfile=car_default_outfile) => {
  argv.option('outfile', {
    type: 'string',
    default: default_outfile
  })
}

const write_file = (argv, bytes) => {
  if (argv.outfile === 'stdout') return
  if (argv.outfile === car_default_outfile) {
    argv.outfile = carcid(bytes) + '.car'
  }
  writeFileSync(argv.outfile, bytes)
}

const car_options = argv => {
  argv.option('stdout', {
    type: 'boolean',
    default: false
  })
  argv.option('publish', {
    type: 'boolean',
    default: false
  })
  outfile_options(argv)
  options(argv)
}

const apply_options = argv => {
  outfile_options(argv, 'stdout')
  argv.option('stdout', {
    type: 'boolean',
    default: true
  })
}

const delta_options = car_options

const options = argv => {
  argv.option('automation', {
    desc: 'Supress feedback prompts. Dangerous when used to overwrite existing files.',
    type: 'boolean',
    default: false
  })
}

const publish = async cardata => {
  let msg = ''
  const tmpfile = tmpdir() + '/' + Math.random() + '.tmp.json'
  msg = await w3up('export-settings', tmpfile)
  const settings = JSON.parse(readFileSync(tmpfile).toString())

  const client = createClient({
    serviceDID: 'did:key:z6MkrZ1r5XBFZjBU34qyD8fueMbMRkKw17BZaq2ivKFjnz2z',
    serviceURL: 'https://8609r1772a.execute-api.us-east-1.amazonaws.com',
    accessDID: 'did:key:z6MkkHafoFWxxWVNpNXocFdU6PL2RVLyTEgS1qTnD3bRP7V9',
    accessURL: 'https://access-api.web3.storage',
    settings: new Map(Object.entries(settings)),
  })

  msg += await client.upload(cardata)
  console.log(msg)
}

const delta = async argv => {
  const source_tree = await FileTree.fromFile({ filename: argv['origin-file'] })
  const dest_tree = await FileTree.fromFile({ filename: argv['updated-file'] })

  if (source_tree.root.toString() === dest_tree.root.toString()) {
    console.error('sorry, these files are an exact match :(')
    process.exit(1)
  }

  const delta = await source_tree.delta(dest_tree)
  const carbytes = await delta.export()
  argv['delta-cid'] = carcid(carbytes)
  if (argv.stdout) {
    process.stdout.write(carbytes)
  } else if (!argv.publish) {
    write_file(argv, carbytes)
    console.log(argv['delta-cid'])
    return
  }
  if (argv.publish) {
    await publish(carbytes)
  } else if (!argv.stdout) {
    process.stdout.write(carbytes)
  }
}
const apply = async argv => {
  const cid = argv['delta-cid']
  if (cid === 'stdin') {
    throw new Error('not implemented')
  }
  let source_tree
  let dest_tree
  let carbytes
  let result
  if (cid.startsWith('bafla') && !cid.contains('.') && !cid.contains('/')) {
    throw new Error('not implemented: car fetch')
  } else {
    source_tree = await FileTree.fromFile({ filename: argv['source-file'] })
    carbytes = readFileSync(cid)
    result = await source_tree.apply(carbytes)
  }
  if (!source_tree) throw new Error('not enough arguments')
  if (argv.outfile !== 'stdout') {
    write_file(argv, result)
  } else {
    process.stdout.write(result)
  }
}

const stat = async argv => {
  const { root } = await treeStat(argv.file)
  console.log(root.toString())
}

const export_command = async argv => {
  const { root, blockmap } = await stat(argv.file)
  const cid = await writeCar(root, blockmap, process.stdout)
}

const w3up_command = async argv => {
  const args = argv._.slice(1)
  const p = w3up(...args)
  //console.log(p)
}

yargs(hideBin(process.argv))
  .command('delta <origin-file> <updated-file>', 'Produce DELTA', delta_options, delta)
  .command('apply <source-file> <delta-cid>', 'Apply DELTA', apply_options, apply)
  .command('stat <file>', 'Prints file encode info', options, stat)
  .command('export <file>', 'Exports a CAR of the entire file for IPFS.', options, export_command)
  .command('w3up', 'Shell out to w3up', options, w3up_command)
  .demandCommand(1)
  .parse()

