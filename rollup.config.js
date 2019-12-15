import pkg from './package.json'

import buble from 'rollup-plugin-buble'
import { uglify } from 'rollup-plugin-uglify'

const input = 'src/uncloak.js'

export default [
  {
    input,
    output: {
      file: pkg.module,
      format: 'esm'
    }
  }, {
    input,
    output: {
      file: pkg.main,
      format: 'umd',
      name: 'Uncloak'
    },
    plugins: [
      buble()
    ]
  }, {
    input,
    output: {
      file: pkg.browser,
      format: 'umd',
      name: 'Uncloak'
    },
    plugins: [
      buble(),
      uglify()
    ]
  }
]
