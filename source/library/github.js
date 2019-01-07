// @flow
import makeFetch from 'make-fetch-happen'
import semver from 'semver'
import tar from 'tar'
import * as components from './components.js'
import {
	mkdirp,
	outputFile
} from 'fs-extra'
import log from './log.js'
import args from './args.js'
import * as workingDirectory from './working-directory.js'

type ReleaseMetadata = {
	version: string,
	tarballUrl: string
}

let logResponseCode = response => (
	log(response.status),
	response
)

let checkResponseGoodness = response =>
	response.ok || response.status === 304
		? response
		: Promise.reject(response)

let fetch = makeFetch.defaults({
	cacheManager: workingDirectory.resolve('github-fetch-cache')
})

let getComponentApiUri = (componentName: string, version?: string): string =>
	[
		'https://api.github.com/repos',
		args.githubOrganisation,
		componentName,
		'releases',
		version
			? `tags/v${version}`
			: 'latest'
	].join('/')

// memo
let getAuthorization = () => {
	let authorization
	return (function () {
		authorization || (
			authorization = `token ${process.env.ON_GITHUB_TOKEN || ''}`
		)
		return authorization
	}())
}

export let getLatestReleaseMetadata = (componentName: string, version?: string): Promise<?ReleaseMetadata> => {
	let url = getComponentApiUri(componentName, version)
	let authorization = getAuthorization()

	log(
		`gonna try getting metadata for ${componentName}${version ? `@${version}` : ''} from ${url}`
	)

	return fetch(url, {
		headers: {authorization}
	})
		.then(logResponseCode)
		.then(checkResponseGoodness)
		.then(response => response.json())
		.then(data => {
			return data && {
				version: semver.clean(data.tag_name || ''),
				tarballUrl: data.tarball_url
			}
		})
		.catch(async response => {
			let {message} = await response.json()
			let rateLimitResetDate = new Date(response.headers.get('x-ratelimit-reset') * 1000)
			console.error(
				`${componentName}:`,
				message,
				'ratelimit reset:',
				rateLimitResetDate.toLocaleTimeString()
			)
		})
}


export let getLatestRelease = async (componentName: string, requestedVersion?: string): Promise<void> => {
	let metadata = await getLatestReleaseMetadata(componentName, requestedVersion)

	if (!metadata) {
		throw `got no release metadata for ${componentName}`
	}

	let componentDirectory = components.resolve(componentName)

	await mkdirp(componentDirectory)

	await outputFile(
		components.getVersionFilePath(componentName),
		metadata.version
	)

	log(`downloading ${componentName}@${metadata.version} from ${metadata.tarballUrl}`)

	let authorization = getAuthorization()

	await new Promise((yay, nay) =>
		fetch(metadata.tarballUrl, {
			headers: {authorization}
		})
			.then(logResponseCode)
			.then(checkResponseGoodness)
			.then(response =>
				response.body.pipe(tar.extract({
					cwd: componentDirectory,
					// newer: true,
					strip: 1,
					onentry: entry => log(entry.path)
				}))
			)
			.then(stream => {
				stream.on('finish', yay)
				stream.on('error', nay)
			})
			.catch(nay)
	)
}