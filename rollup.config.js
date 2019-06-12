import pkg from './package.json';

import { terser } from 'rollup-plugin-terser';
import buble from 'rollup-plugin-buble';
import { uglify } from 'rollup-plugin-uglify';

export default [
  {
    input: 'src/uncloak.js',
    output: {
      file: 'dist/uncloak.esm.js',
      format: 'esm'
    }
  }, {
    input: 'src/uncloak.js',
    output: {
      file: 'dist/uncloak.esm.min.js',
      format: 'esm'
    },
    plugins: [
      terser({
        ecma: 6,
        keep_classnames: true,
        keep_fnames: true,
        safari10: true,
        sourcemap: false
      })
    ]
  }, {
    input: 'src/uncloak.js',
    output: {
      file: 'dist/uncloak.js',
      format: 'iife',
      name: pkg.name
    },
    plugins: [
      buble()
    ]
  }, {
    input: 'src/uncloak.js',
    output: {
      file: 'dist/uncloak.min.js',
      format: 'iife',
      name: pkg.name
    },
    plugins: [
      buble(),
      uglify()
    ]
  }
];
