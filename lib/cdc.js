import fastcdc from 'fastcdc-wasm'

const cdc = (buffer, { min, max, avg }) => {
  return fastcdc.get_chunks(buffer, min, avg, max)
}

export default cdc
