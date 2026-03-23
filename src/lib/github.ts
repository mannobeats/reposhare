import { createAppAuth } from "@octokit/auth-app"
import { Octokit } from "@octokit/rest"
import { prisma } from "./prisma"

export async function getGitHubAppConfig() {
  const config = await prisma.systemConfig.findUnique({
    where: { id: "singleton" },
  })
  if (!config)
    throw new Error("RepoShare App is not configured. Please run setup.")
  return config
}

export async function getOctokitForInstallation(
  installationId: string | number,
) {
  const config = await getGitHubAppConfig()

  const octokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: config.appId,
      privateKey: config.privateKey,
      installationId:
        typeof installationId === "string"
          ? parseInt(installationId, 10)
          : installationId,
    },
  })

  return octokit
}

// Generates a short-lived installation access token directly via API for raw Git Proxy usage
export async function getInstallationToken(installationId: string | number) {
  const config = await getGitHubAppConfig()

  const appOctokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: config.appId,
      privateKey: config.privateKey,
    },
  })

  // Grab physical token to embed perfectly into Git HTTP payloads
  const { data } = await appOctokit.rest.apps.createInstallationAccessToken({
    installation_id:
      typeof installationId === "string"
        ? parseInt(installationId, 10)
        : installationId,
  })

  return data.token
}
