#!/usr/bin/env node

import yargs from 'yargs'
import { readFileSync, writeFileSync } from 'fs'
import { hideBin } from 'yargs/helpers'
import { stat as treeStat, FileTree, writeCar } from './tree.js'

const car_default_outfile = '${cid}.car'

const outfile_options = (argv, default_outfile=car_default_outfile) => {
  argv.option('outfile', {
    type: 'string',
    default: default_outfile
  })
}

const write_file = (argv, bytes) => {
  if (argv.outfile === 'stdout') return
  if (argv.outfile === car_default_outfile) {
    throw new Error('not implemented')
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

const delta = async argv => {
  const source_tree = await FileTree.fromFile({ filename: argv['origin-file'] })
  const dest_tree = await FileTree.fromFile({ filename: argv['updated-file'] })

  if (source_tree.root.toString() === dest_tree.root.toString()) {
    console.error('sorry, these files are an exact match :(')
    process.exit(1)
  }

  const delta = await source_tree.delta(dest_tree)
  const carbytes = await delta.export()
  if (argv.stdout) {
    process.stdout.write(carbytes)
  } else if (!argv.publish) {
    write_file(argv, carbytes)
    return
  }
  if (argv.publish) {
    throw new Error('unimplemented, i\'ll get around to it soon tho')
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

yargs(hideBin(process.argv))
  .command('delta <origin-file> <updated-file>', 'Produce DELTA', delta_options, delta)
  .command('apply <source-file> <delta-cid>', 'Apply DELTA', apply_options, apply)
  .command('stat <file>', 'Prints file encode info', options, stat)
  .command('export <file>', 'Exports a CAR of the entire file for IPFS.', options, export_command)
  .demandCommand(1)
  .parse()

