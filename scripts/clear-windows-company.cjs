const fs = require("node:fs/promises");
const path = require("node:path");
const { NtExecutable, NtExecutableResource, Resource } = require("resedit");

module.exports = async function clearWindowsCompany(context) {
  if (context.electronPlatformName !== "win32") return;

  const executablePath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`);
  const executable = NtExecutable.from(await fs.readFile(executablePath));
  const resources = NtExecutableResource.from(executable);
  const versionInfos = Resource.VersionInfo.fromEntries(resources.entries);

  for (const versionInfo of versionInfos) {
    for (const language of versionInfo.getAllLanguagesForStringValues()) {
      versionInfo.removeStringValue(language, "CompanyName", false);
      versionInfo.setStringValues(language, { LegalCopyright: "Copyright © 2026" }, false);
    }
    versionInfo.outputToResourceEntries(resources.entries);
  }

  resources.outputResource(executable);
  await fs.writeFile(executablePath, Buffer.from(executable.generate()));
};
