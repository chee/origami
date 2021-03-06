import * as npm from "../lib/npm"
import * as chai from "chai"
import chaiAsPromised from "chai-as-promised"

chai.use(chaiAsPromised)
const expect = chai.expect
import mappings from "../config/mappings"
import snap from "snap-shot-it"
let specCompliantBowerConfig = require("o-spec-compliant-bower-config/bower.json")

let props = {
	name: "yeet",
	version: "0.0.0-yeet",
}

describe("merge manifests", () => {
	it("prefers deps from the generated over the existing", () => {
		let existing = {
			...props,
			dependencies: {a: "1", b: "2", c: "3"},
		}
		let generated = {
			...props,
			dependencies: {b: "2", c: "5"},
		}
		expect(npm.mergeManifests(existing, generated)).to.eql({
			...props,
			dependencies: {
				a: "1",
				b: "2",
				c: "5",
			},
			devDependencies: {},
			scripts: {},
		})
	})

	it("prefers dev-deps from the generated over the existing", () => {
		let existing = {
			...props,
			devDependencies: {a: "1", b: "2", c: "3"},
		}
		let generated = {
			...props,
			devDependencies: {b: "2", c: "5"},
		}
		expect(npm.mergeManifests(existing, generated)).to.eql({
			...props,
			devDependencies: {
				a: "1",
				b: "2",
				c: "5",
			},
			dependencies: {},
			scripts: {},
		})
	})

	it("prefers scripts from the generated over the existing", () => {
		let existing = {
			...props,
			scripts: {a: "old", b: "town", c: "yeet"},
		}
		let generated = {
			...props,
			scripts: {c: "road"},
		}
		expect(npm.mergeManifests(existing, generated)).to.eql({
			...props,
			scripts: {
				a: "old",
				b: "town",
				c: "road",
			},
			dependencies: {},
			devDependencies: {},
		})
	})
})

describe("createComponentName", () => {
	it("adds the default npm org", () => {
		expect(npm.createComponentName("yeet")).to.eql("@financial-times/yeet")
	})

	it("accepts another npm org", () => {
		expect(npm.createComponentName("monkey", "ftlabs")).to.eql("@ftlabs/monkey")
	})
})

describe("createDependencyVersion", () => {
	it("uses version from mapping config", async () => {
		let [[from, to]] = Object.entries(mappings.version)
		let result = await npm.createDependencyVersion(["yeet", from])
		expect(result).to.eql(to)
	})

	it("uses a valid semver if there is one", async () => {
		let version = "0.0.0-0.0.0-0.0.0-yeet"
		let result = await npm.createDependencyVersion(["yeet", version])
		expect(result).to.eql(version)
	})

	it("uses a valid semver if there is one in a hash", async () => {
		let semver = "0.0.0-0.0.0-0.0.0-yeet"
		let version = `blablahblah#${semver}`
		let result = await npm.createDependencyVersion(["yeet", version])
		expect(result).to.eql(semver)
	})

	it("throws otherwise", async () => {
		let nonSemver = "$0.$0.0-0.0.0-0.0.0-yeet$17"
		let hashVersion = `blablabla#${nonSemver}`
		let nonSemverResult = npm.createDependencyVersion(["yeet", nonSemver])
		let hashVersionResult = npm.createDependencyVersion(["yeet", hashVersion])
		await expect(nonSemverResult).to.be.eventually.rejected
		await expect(hashVersionResult).to.be.eventually.rejected
		await hashVersionResult.catch(error => {
			expect(error.message).to.contain(hashVersion)
		})
		await nonSemverResult.catch(error => {
			expect(error.message).to.contain(nonSemver)
		})
	})
})

describe("createManifest", () => {
	context("without a repository parameter", function () {
		it("creates the same manifest as last time", async () => {
			snap(await npm.createManifest(specCompliantBowerConfig))
		})
	})

	context("with a repository parameter", function () {
		it("creates the same manifest as last time", async () => {
			snap(
				await npm.createManifest(
					specCompliantBowerConfig,
					"https://origami.ft.com"
				)
			)
		})
	})
})

describe("cleanManifest", async () => {
	it("removes aliases", async () => {
		expect(
			await npm.cleanManifest(
				Promise.resolve({
					...props,
					aliases: {
						a: "b",
					},
				})
			)
		).to.eql(props)
	})
	it("doesnt mutate the object", async () => {
		let aliases = {
			a: "b",
		}
		let manifest = {...props, aliases}
		let clean = await npm.cleanManifest(Promise.resolve(manifest))
		expect(clean).not.to.eql(manifest)
		expect(manifest.aliases).to.eql(aliases)
	})
})
