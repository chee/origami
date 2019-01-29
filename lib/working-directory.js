import * as yargs from "yargs"
import createResolver from "./create-resolver.js"

/**
 * Working directory resolve
 *
 * @param  {...string} paths the paths you'd like to resolve
 */
export let resolve = (...paths) =>
	createResolver(yargs.argv.workingDirectory)(...paths)