//
// import type {
// 	NpmManifest,
// 	BowerManifest
// } from '../types/manifest.types'

// import type {
// 	Dependency
// } from '../types/dependency.types'

import npmLifecycle from "npm-lifecycle"
import readPackageJson from "read-package-json"
import * as semver from "semver"
import hashVersionRegex from "./hash-version-regex.js"
import read from "./read-object.js"
import write from "./write-object.js"
import * as components from "./components.js"
import mappings from "./mappings.js"
import log from "./log.js"
import * as bower from "./bower.js"
import * as babel from "./babel.js"
import * as workingDirectory from "./working-directory.js"
import {entries, keys, merge} from "./dictionary.js"
import {componentManifest as skeleton} from "./skeletons.js"
import compose from "./compose.js"
import checkFileIsAccessible from "./check-file-is-accessible.js"
import chalk from "chalk"
import settings from "./settings.js"
import * as util from "util"

export let getManifestPath = componentName =>
	components.resolve(componentName, "package.json")

export let checkHasManifest = compose(
	checkFileIsAccessible,
	getManifestPath
)

export let getManifest = compose(
	read,
	getManifestPath
)

export let getLibnpmStyleManifest = compose(
	util.promisify(readPackageJson),
	getManifestPath
)

export let mergeManifests = (existing, generated) => {
	let dependencies = merge(
		existing.dependencies || {},
		generated.dependencies || {}
	)
	let devDependencies = merge(
		existing.devDependencies || {},
		generated.devDependencies || {}
	)
	let scripts = merge(existing.scripts || {}, generated.scripts || {})
	let {main} = existing

	let result = {
		...generated,
		scripts,
		dependencies,
		devDependencies
	}

	main && (result.main = main)

	return result
}

export let getAllDependencyNames = manifest =>
	keys(
		merge(
			manifest.optionalDependencies || {},
			manifest.peerDependencies || {},
			manifest.devDependencies || {},
			manifest.dependencies
		)
	)

export let createComponentName = (
	componentName,
	npmOrganisation = settings.npmOrganisation
) => `@${npmOrganisation}/${componentName}`

export let createDependencyName = name => {
	if (components.includes(name)) {
		return createComponentName(name)
	}

	let mapping = mappings.name[name]

	if (mapping) {
		return mapping
	}

	return name
}

export let createDependencyVersion = async ([name, version]) => {
	// if there is a mapping, use that
	let mappingVersion = mappings.version[version]

	if (mappingVersion) {
		return mappingVersion
	}

	// if it is a valid semver range, use that
	let validRange = semver.validRange(version)

	if (validRange) {
		return version
	}

	// or, if there is a hash location in the version
	let hashMatch = hashVersionRegex.exec(version)

	if (hashMatch) {
		let [, hash] = hashMatch

		// and it's a valid semver range, use that
		let validHashRange = semver.validRange(hash)

		if (validHashRange) {
			return hash
		}
	}

	// or, try getting the version bower resolved to
	let bowerVersion =
		(await bower.checkHasManifest(name)) &&
		(await bower.getManifest(name)).version

	if (bowerVersion) {
		return bowerVersion
	}

	// or, if there's a package json there, use that version
	let packageJsonVersion =
		(await checkHasManifest(name)) && (await getManifest(name)).version

	if (packageJsonVersion) {
		return packageJsonVersion
	}

	// or die
	throw Error(
		`oh no, i couldn't turn ${name}'s '${version} into a suitable npm version`
	)
}

let stringifyDependency = ([name, version]) => {
	return JSON.stringify({[name]: version})
}

let logChange = (one, two) =>
	log(
		chalk.gray(`${stringifyDependency(one)} -> ${stringifyDependency(two)}`),
		2
	)

export let createDependency = async ([name, version]) => {
	let npmName = await createDependencyName(name)
	let npmVersion = await createDependencyVersion([name, version])

	logChange([name, version], [npmName, npmVersion])

	return [npmName, npmVersion]
}

export let createDependencies = async bowerDependencies => {
	let npmDependencies = await Promise.all(
		bowerDependencies.map(createDependency)
	)

	return npmDependencies.reduce((dependencies, dependency) => {
		let [name, version] = dependency

		dependencies[name] = version
		return dependencies
	}, {})
}

let createAliases = dependencies => {
	let dependencyNames = keys(dependencies || {})

	return components.names.all.reduce(
		(aliases, componentName) => {
			if (dependencyNames.includes(componentName)) {
				aliases[componentName] = createComponentName(componentName)
			}

			return aliases
		},
		{...mappings.name}
	)
}

export let createManifest = async bowerManifest => {
	let {
		name,
		version: bowerVersion,
		description,
		homepage,
		license
	} = bowerManifest

	let version = (await components.getVersion(name)) || bowerVersion

	let dependencies = bowerManifest.dependencies

	let npmName = createComponentName(name)
	let npmDependencies =
		dependencies && (await createDependencies(entries(dependencies)))

	log(chalk.cyan(`creating ${name}@${version} as ${npmName}@${version}`))

	return {
		...skeleton,
		name: npmName,
		version,
		description,
		homepage,
		dependencies: npmDependencies,
		component: name,
		babel: babel.createConfiguration({
			aliases: createAliases(dependencies)
		}),
		license
	}
}

export let mergeManifestWithExistingManifest = async manifestPromise => {
	let manifest = await manifestPromise
	let hasManifest = await checkHasManifest(manifest.component)

	if (!hasManifest) {
		return manifest
	}

	let existingManifest = await getManifest(manifest.component)
	return mergeManifests(existingManifest, manifest)
}

export let writeManifest = async (manifestPromise, path) => {
	let manifest = await manifestPromise

	path = path || getManifestPath(manifest.component)

	return write(path, manifest)
}

export let cleanManifest = async manifestPromise => {
	let manifest = {...(await manifestPromise)}

	manifest.babel && delete manifest.babel

	return manifest
}

let logProxy = new Proxy({}, {get: () => log})

export let run = async (componentName, scriptName) => {
	return npmLifecycle(
		await getLibnpmStyleManifest(componentName),
		scriptName,
		components.resolve(componentName),
		{
			log: logProxy,
			unsafePerm: true,
			dir: workingDirectory.resolve("node_modules"),
			config: {}
		}
	)
}

export let build = componentName => run(componentName, "build-component")

export let createAndWriteManifest = async componentName => {
	let bowerManifest = await bower.getManifest(componentName)

	return compose(
		writeManifest,
		mergeManifestWithExistingManifest,
		createManifest
	)(bowerManifest)
}

export let createRegistryArgument = registry =>
	registry
		? `--registry=${String(registry)}`
		: ""

export let cleanAndWriteManifest = compose(
	writeManifest,
	cleanManifest,
	getManifest
)