import checkFileIsAccessible from "./check-file-is-accessible.js"
import read from "./read-object.js"
import compose from "./compose.js"
import * as components from "./components.js"
import {keys, merge} from "./dictionary.js"

/**
 * get all dependency & devDependency names
 * @param {{dependencies: object.<string, string>, devDependencies: object.<string, string>}} manifest a bower manifest
 * @returns {string[]} dependency names
 */
export let getAllDependencyNames = manifest =>
	keys(merge(manifest.devDependencies || {}, manifest.dependencies))

export let getManifestPath = componentName =>
	components.resolve(componentName, "bower.json")

export let getManifest = compose(
	read,
	getManifestPath
)

export let checkHasManifest = compose(
	checkFileIsAccessible,
	getManifestPath
)