#!/usr/bin/env node
import spawn from "../lib/spawn.js"
import * as components from "../lib/components.js"
import * as npm from "../lib/npm.js"
import * as babel from "../lib/babel.js"
import * as github from "../lib/github.js"
import chalk from "chalk"
import * as fs from "fs-extra"

export let command = "bootstrap"
export let describe = "download, convert and publish all origami components"

let getCommands = ({registry, unpublish, publish, obt}) => {
	let createSpawnArgs = name => ({cwd: components.resolve(name)})
	let registryArgument = npm.createRegistryArgument(registry)
	let npmSpawn = (command, flag) => name =>
		flag && spawn(
			`npm ${command} --force ${registryArgument}`,
			createSpawnArgs(name)
		).catch(`couldn't unpublish "${name}!"`)

	return [
		npm.createAndWriteManifest,
		babel.compile,
		npm.cleanAndWriteManifest,
		npmSpawn("unpublish", unpublish),
		npmSpawn("publish", publish),
		npm.removeLockfile,
		name => obt && spawn(
			"npx obt i --ignore-bower",
			createSpawnArgs(name)
		),
		name => obt && spawn(
			"npx obt t --ignore-bower",
			createSpawnArgs(name)
		)
	]
}

let orders = {
	async component (argv) {
		let commands = getCommands(argv)
		await components.sequence(async name => {
			for (let command of commands) {
				await command(name)
			}
		})
	},
	async operation (argv) {
		let commands = getCommands(argv)
		for (let command of commands) {
			await components.sequence(command)
		}
	}
}

let validOrders = Object.keys(orders)

/**
 * @type {Object.<string, import('yargs').Options>}
 */
let options = {
	download: {
		default: true,
		type: "boolean"
	},
	publish: {
		alias: "p",
		describe: "publish to npm registry",
		default: true,
		type: "boolean"
	},
	unpublish: {
		alias: "u",
		describe: "remove from npm registry",
		default: false,
		type: "boolean"
	},
	registry: {
		alias: ["npmRegistry"],
		default: "http://localhost:4873",
		type: "string",
		describe: "the npm registry to use (the default is verdaccio's default)"
	},
	order: {
		default: validOrders[0],
		type: "string",
		describe: "the order in which to run the operations",
		choices: validOrders
	}
}

export let builder = yargs => yargs.options(options)

export let handler = async function ဪ(argv) {
	argv.components && components.setTargets(argv.components)

	// must download everything first, otherwise can't sort
	// because the sort uses the bower registry.
	// would be great to do this another way
	await components.sequence(name => fs.remove(components.resolve(name)), components.names.targets)
	await components.sequence(github.getLatestRelease, components.names.targets)

	let order = orders[argv.order]

	if (!order) {
		console.info(
			chalk.bold.red(
				`no such order! try one of: ${validOrders}`
			)
		)
		process.exit(33)
	}

	await order(argv)

	console.info(chalk.bold.cyan("hooray!!"))
}
