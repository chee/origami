#!/usr/bin/env node
// @flow
require('dotenv').config()
import log from './library/log.js'
import spawn from './library/spawn.js'
import args from './library/args.js'
import * as components from './library/components.js'
import * as npm from './library/npm.js'
import * as root from './library/root.js'
import * as babel from './library/babel.js'
import read from './library/read-object.js'
import write from './library/write-object.js'
import * as fs from 'fs-extra'
import * as workingDirectory from './library/working-directory.js'
import * as github from './library/github.js'

let copyPackageJson = async () => {
	let rootManifest = await read(root.resolve('package.json'))
	rootManifest.name = Math.random().toString(36).slice(2)
	return write('package.json', rootManifest)
}

void async function ဪ () {
	args.printComponents &&
		(log((await components.sort()).join('\n'), 0), process.exit())

	if (args.exec) {
		await components.batch(args.exec)
		process.exit(0)
	}

	args.initialise && await copyPackageJson()
	args.initialise && await fs.copy(
		root.resolve('npmrc'),
		workingDirectory.resolve('.npmrc')
	)

	args.initialise && await spawn('npm install --no-package-lock')
	args.fresh && await spawn('rm -rf ./components/')
	args.download && await components.sequence(github.getLatestRelease, args.components)
	args.createManifests && await components.sequence(npm.createAndWriteManifest)
	args.npmInstall && await components.batch('npm install --no-package-lock', undefined, 4)
	args.createLinks && await components.batch('npm link')
	args.createLinks && await components.sequence(async name => {
		if (!name) return false

		let names = (
			await components.sort([name])
		)
			.map(npm.createComponentName)
			.join(' ')

		return Boolean(names.length) &&
			`npm link ${names}`
	})
	args.build && await components.sequence(babel.compile)
	args.cleanManifests && await components.sequence(npm.cleanAndWriteManifest)
	args.unpublish && await components.batch('npm unpublish --force')
	args.publish && await components.batch('npm publish')
	args.hokeyCokey && await components.batch('npm unpublish --force')

	log('oh good', 0)
}().catch(error => {
	log(error, 0)
	process.exit(22)
})
