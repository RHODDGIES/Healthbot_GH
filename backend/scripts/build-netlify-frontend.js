const fs = require("node:fs");
const path = require("node:path");

const FIREBASE_WEB_VARIABLES = {
  apiKey: "FIREBASE_WEB_API_KEY",
  authDomain: "FIREBASE_WEB_AUTH_DOMAIN",
  projectId: "FIREBASE_WEB_PROJECT_ID",
  storageBucket: "FIREBASE_WEB_STORAGE_BUCKET",
  messagingSenderId: "FIREBASE_WEB_MESSAGING_SENDER_ID",
  appId: "FIREBASE_WEB_APP_ID"
};

function getFirebaseWebConfig(environment = process.env) {
  const missingVariables = Object.values(
    FIREBASE_WEB_VARIABLES
  ).filter((variableName) => !environment[variableName]);

  if (missingVariables.length) {
    throw new Error(
      `Missing required Firebase web configuration: ${missingVariables.join(", ")}.`
    );
  }

  return Object.fromEntries(
    Object.entries(FIREBASE_WEB_VARIABLES).map(
      ([configKey, variableName]) => [
        configKey,
        environment[variableName]
      ]
    )
  );
}

function shouldCopyFrontendPath(sourcePath) {
  const basename = path.basename(sourcePath).toLowerCase();

  if (
    basename === "firebase-config.js" ||
    basename === "firebase-config.example.js" ||
    basename === "docs" ||
    basename === ".env" ||
    basename.startsWith(".env.") ||
    basename.endsWith(".log") ||
    /service[-_]?account/.test(basename) ||
    /serviceaccount/.test(basename)
  ) {
    return false;
  }

  return true;
}

function assertSafeOutputDirectory(
  frontendDirectory,
  outputDirectory
) {
  const frontendPath = path.resolve(frontendDirectory);
  const outputPath = path.resolve(outputDirectory);

  if (
    outputPath === frontendPath ||
    outputPath === path.parse(outputPath).root ||
    outputPath.startsWith(`${frontendPath}${path.sep}`) ||
    frontendPath.startsWith(`${outputPath}${path.sep}`)
  ) {
    throw new Error("Refusing to replace an unsafe build output directory.");
  }
}

function buildNetlifyFrontend({
  environment = process.env,
  frontendDirectory = path.resolve(__dirname, "../../frontend"),
  outputDirectory = path.resolve(__dirname, "../dist"),
  privacyPolicyPath = path.resolve(
    __dirname,
    "../../privacy-policy.html"
  )
} = {}) {
  const firebaseConfig = getFirebaseWebConfig(environment);

  assertSafeOutputDirectory(
    frontendDirectory,
    outputDirectory
  );

  fs.rmSync(outputDirectory, {
    recursive: true,
    force: true
  });

  fs.cpSync(frontendDirectory, outputDirectory, {
    recursive: true,
    filter: shouldCopyFrontendPath
  });

  fs.copyFileSync(
    privacyPolicyPath,
    path.join(outputDirectory, "privacy-policy.html")
  );

  const firebaseConfigSource = [
    "// Generated during the Netlify build from public Firebase web settings.",
    `export const firebaseConfig = ${JSON.stringify(firebaseConfig, null, 2)};`,
    ""
  ].join("\n");

  fs.writeFileSync(
    path.join(outputDirectory, "firebase-config.js"),
    firebaseConfigSource,
    "utf8"
  );

  return outputDirectory;
}

if (require.main === module) {
  try {
    const outputDirectory = buildNetlifyFrontend();

    console.log(
      `Prepared the Netlify frontend in ${path.basename(outputDirectory)}.`
    );
  } catch (error) {
    console.error(`Netlify frontend build failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  FIREBASE_WEB_VARIABLES,
  buildNetlifyFrontend,
  getFirebaseWebConfig,
  shouldCopyFrontendPath
};
