import commonjs from "@rollup/plugin-commonjs";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import dts from "rollup-plugin-dts";
import { terser } from "rollup-plugin-terser";
import typescript from "rollup-plugin-typescript2";
import * as path from "node:path"

const isProd = process.env.NODE_ENV === "production";

export default [
  {
    input: "./src/index.ts",
    output: [
      {
        file: path.resolve(__dirname, "../../dist/debug/masterchat/masterchat.js"),
        sourcemap: !isProd,
        format: "cjs",
      },
      {
        file: path.resolve(__dirname, "../../dist/debug/masterchat/masterchat.mjs"),
        sourcemap: !isProd,
        format: "es",
      },
    ],
    plugins: [
      typescript({
        tsconfig: "./tsconfig.build.json",
      }),
      nodeResolve({
        preferBuiltins: false, // required for `events` polyfill
      }),
      commonjs(),
      // isProd &&
      //   terser({
      //     keep_classnames: true, // avoid Error class mangling
      //   }),
    ],
    external: ["cross-fetch", "debug"],
  },
  {
    input: path.resolve(__dirname, "../../dist/debug/masterchat/index.d.ts"),
    output: {
      file: path.resolve(__dirname, "../../dist/debug/masterchat/masterchat.d.ts"),
      format: "es",
    },
    plugins: [dts()],
  },
];
