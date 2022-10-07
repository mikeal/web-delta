# Web DELTA

**Warning: this is new code and the DELTA format will likely change. Keep
a copy of the exact version you produce DELTAs with in order to ensure
you can merge them until the format stabilized.**

This is a set of protocols for producing deltas between sequences of bytes (files,
memory, etc), serializing the DELTA (changed bytes), and efficiently
sharing and applying them.

As a bonus, data duplicated within a file or between files in the same delta
will be de-duplicated, similar to `git`.

```
> wd delta old-file.zim new-file.zim --publish
biglongcarcidasdhf9a8sdhf9a8sdhf9as8dfh9a8fdha9
```

**Note: `--publish` will be implemented soon, for now you can work with local
export.**

Anyone with the source file, or any file similar *enough* to the original,
can apply the delta from anywhere in the world using the identifier returned
from publish.

```
> wd apply file.zim biglongcarcidasdhf9a8sdhf9a8sdhf9as8dfh9a8fdha9 --outfile=new.zim
```

Since the DELTAs are in valid IPFS data format (more below) you can read
the full file at any time by content CID, which you can also find using the
`stat` command. This works as long as enough of the source data has been
published from different DELTAs, if you want to publish a whole file is
available you can use `export --publish`.

Unlike `git`, large files and small files have roughly the same efficiency
and large file deltas have acceptable performance (no need for something
like git-lfs).

If you don't want to publish the delta or share the delta identifier,
the `delta` command will export the DELTA to a file you can share
whenever you don't pass `--publish`.

```
wd old-file.txt new-file.txt
biglongcarcidasdhf9a8sdhf9a8sdhf9as8dfh9a8fdha9.car
```

There's no peer-to-peer transports involved in this protocol as it is
designed to run across any transport that can move the bytes for the DELTA,
which is in CAR (IPFS export) format.

There's also a nice JS API.

With this, you can write programs that move deltas between the state of
*any format*, even archives if the compression system is content aware
enough to produce consistent frames after being edited.

Since Web DELTA use IPFS data structures, the content can be retrieved
from IPFS gateways can be made available to the public IPFS network
(which is what `--publish` will do). If you're missing the source
file data for a DELTA, you can even recover the parts of the tree
you don't have from the public network :)

There's no peer-to-peer ***transports*** involved in this protocol as it is
designed to run across any transport that can move the bytes, which means
there's never any need to "run an node."

You don't need to run a server or any app continuously. Any workflow you
have in code or in systems you can call out to Web DELTA.

Web DELTA is designed to run directly on regular files and other sequences of bytes.
Data never needs to be loaded into a secondary block store in order to
produce deltas between states. Since the protocol simply compares two separate,
*presumed* to be similar, binary sequences and compares them you only ever
need to hold the old state of the file.

Since the content identifiers used to compare states are valid IPFS CIDs,
if you make them available in the public network then you don't even need
to keep around the old state because *any* program can read the old state
from the public network whenever you need to do the comparison.

By default, the Web DELTA tooling in this repo uses web3.storage for the default
publishing flow, but web3.storage uses an open permissioning protocol (UCAN)
so other services are free to implement the same protocol and can then be
configured here as an upload provider.

This system is **very fast**.

Not only are you moving much smaller amounts of data around, web3.storage puts the
resulting deltas in a CDN and can resolve the data for DELTA in a single
round-trip.

This protocol has been designed to, eventually, make its way into Web Browsers.
The constraints of this environment, and the legitimate privacy and security
concerns regarding any protocol added to browsers, are included in the design
and the author previously worked at Mozilla and maintains good relationships
in the Web community so this has some chance of success :) 

# How it works

The Web DELTA Protocol works with sequences of bytes as input. All data,
at some point, is turned into bytes, everything from documents to custom
data structures do, at some point, turn into bytes.

Most programs that alter these bytes will make small changes to
discreet portions of the bytes, depending on the format. This is true
for almost all document formats, even most binary formats, but is less
typical in compressed formats. Encrypted data would be considered "perverse"
in this regard and is a poor fit unless you're writing a program
specifically tailored to fitting encrypted data into The Web DELTA Protocol
(coming soon :-).

## Data Structures

### Byte Sequence Encoding

First, Web DELTA chunks the bytes using a content defined chunker (fastcdc) with
stable settings to ensure determinism between clients. This is identical to
what `git` does to file data, `git` just uses a different content defined chunker
(rabin). The result is a sequence of grouped bytes that will deterministically
break in roughly the same places.

Each block of bytes is hashed and those hashes are used to create a
merkle tree from the block hashes and the hashes of each branch.
This is where Web Delta makes some improvements over `git` using some new
data structures not known at the time `git` was developed (prolly trees).

Using a similar content defined chunking algorithm, the tree is formed
deterministically from the input, breaking along consistent boundaries. This
results in a tree that is just as probablistically split as the chunked data,
which results in efficient deltas and a self-balanced and well sorted tree
that never needs to be compacted.

From this point on, most comparisons between the two states can be accomplish
with simple Set comparisons rather than expensive traversals. This also makes
it possible to design zero-knowledge proofs that can tell if a set of blocks
captures the delta between two files *without sharing* ***any*** *of the source data*.

The format of this tree is also a valid IPFS File :)

The format of the resulting DELTA is a CAR file (IPFS export format).

So the results of this system are entirely compatible with existing IPFS tooling ecosystem.
However, this a **one-way compatibility**, since Web DELTA depends upon the encoding
above you cannot compare arbitrary IPFS content addresses (CIDs) and arrive at
efficient DELTAs and are likely to produce DELTAs that are slightly larger than
the input file.

## Sync Format

**NOT IMPLEMENTED!**

This format is designed to represent files and directories, and that's the
terminology used throughout this document, but it could also be seen as
a key/value structure that programs could find interesting patterns to
write into in the same way that S3 keys look like files paths but are
programmed to fit numerous non-file used cases.

The Sync Format is a data structure serialization algorithm designed for
the above encoding. The default `sync` tooling will produce a
serialization of an entire directory tree, capturing the full depth of
the tree as it appears on-disc.

The first line is JSON config information. This determines:
* any filters on the file/directory traversal
* publish settings

The rest of the format is newline separated, with extra newlines added
after directory depth closures to encourage splitting in the chunker.

Each fully qualified line is pair of file to CID `relative/but/full/file-path.txt:${CID}`.

The file is written after each successful publish so that, at any time,
a comparison can be made of the local files to that of the last publish.
