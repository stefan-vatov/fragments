import { readFileSync, writeFileSync } from "node:fs";

const targetVersion = process.argv[2];

if (
  !targetVersion ||
  !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(targetVersion)
) {
  throw new Error("Pass a semantic version such as 1.2.3.");
}

const writeJson = (path, value) => {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
};

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
packageJson.version = targetVersion;
writeJson("package.json", packageJson);

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
manifest.version = targetVersion;
writeJson("manifest.json", manifest);

const versions = JSON.parse(readFileSync("versions.json", "utf8"));
versions[targetVersion] = manifest.minAppVersion;
writeJson("versions.json", versions);
