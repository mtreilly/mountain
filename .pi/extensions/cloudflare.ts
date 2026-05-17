/**
 * Cloudflare Deployment Extension for pi
 *
 * Deploy projects to Cloudflare Pages and Workers directly from pi.
 * Supports authentication via API tokens, project configuration, and deployment management.
 *
 * Usage:
 *   /cloudflare status          - Check authentication and project status
 *   /cloudflare deploy          - Deploy current project to Cloudflare
 *   /cloudflare config          - Configure Cloudflare settings
 *   /cloudflare logs [id]       - View deployment logs
 *   /cloudflare deployments     - List recent deployments
 *
 * Environment:
 *   CLOUDFLARE_API_TOKEN        - Cloudflare API token (required)
 *   CLOUDFLARE_ACCOUNT_ID       - Cloudflare account ID (optional, can be configured)
 */

import type {
	ExtensionAPI,
	ExtensionContext,
	ToolResult,
} from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { Text } from "@mariozechner/pi-tui";

// Types
interface CloudflareConfig {
	accountId?: string;
	projectName?: string;
	deploymentType: "pages" | "workers";
	buildCommand?: string;
	outputDirectory?: string;
}

interface DeploymentResult {
	success: boolean;
	deploymentId?: string;
	url?: string;
	message: string;
}

// State
let config: CloudflareConfig = {
	deploymentType: "pages",
	buildCommand: "npm run build",
	outputDirectory: "dist",
};

// Helper: Get API token from environment
function getApiToken(): string | undefined {
	return process.env.CLOUDFLARE_API_TOKEN;
}

// Helper: Check if wrangler is available
async function checkWrangler(pi: ExtensionAPI): Promise<boolean> {
	try {
		const result = await pi.exec("wrangler", ["--version"], { timeout: 5000 });
		return result.code === 0;
	} catch {
		return false;
	}
}

// Helper: Get account ID from wrangler config or environment
async function getAccountId(
	pi: ExtensionAPI,
	cwd: string,
): Promise<string | undefined> {
	// Check environment first
	if (process.env.CLOUDFLARE_ACCOUNT_ID) {
		return process.env.CLOUDFLARE_ACCOUNT_ID;
	}

	// Try to read from wrangler.toml
	try {
		const result = await pi.exec(
			"wrangler",
			["config", "get", "account_id"],
			{ cwd, timeout: 5000 },
		);
		if (result.code === 0 && result.stdout.trim()) {
			return result.stdout.trim();
		}
	} catch {
		// Ignore errors
	}

	return config.accountId;
}

// Helper: Get project name from wrangler config or package.json
async function getProjectName(pi: ExtensionAPI, cwd: string): Promise<string | undefined> {
	// Try to read from wrangler.toml
	try {
		const result = await pi.exec(
			"wrangler",
			["pages", "project", "get"],
			{ cwd, timeout: 10000 },
		);
		if (result.code === 0) {
			// Parse project name from output
			const match = result.stdout.match(/Project name:\s*(.+)/);
			if (match) return match[1].trim();
		}
	} catch {
		// Ignore errors
	}

	// Try to get from package.json name
	try {
		const pkg = await pi.exec("cat", ["package.json"], { cwd, timeout: 5000 });
		if (pkg.code === 0) {
			const parsed = JSON.parse(pkg.stdout);
			if (parsed.name) return parsed.name;
		}
	} catch {
		// Ignore errors
	}

	return config.projectName;
}

// Helper: Run deployment
async function deployToCloudflare(
	pi: ExtensionAPI,
	cwd: string,
	signal?: AbortSignal,
	onUpdate?: (update: Partial<ToolResult>) => void,
): Promise<DeploymentResult> {
	const apiToken = getApiToken();
	if (!apiToken) {
		return {
			success: false,
			message:
				"CLOUDFLARE_API_TOKEN not set. Please set your Cloudflare API token in the environment.",
		};
	}

	const accountId = await getAccountId(pi, cwd);
	if (!accountId) {
		return {
			success: false,
			message:
				"Cloudflare account ID not found. Set CLOUDFLARE_ACCOUNT_ID or configure with /cloudflare config",
		};
	}

	// Check for wrangler.toml
	try {
		const tomlCheck = await pi.exec("test", ["-f", "wrangler.toml"], {
			cwd,
			timeout: 5000,
		});
		if (tomlCheck.code !== 0) {
			return {
				success: false,
				message:
					"No wrangler.toml found. Run 'wrangler init' or configure your project first.",
			};
		}
	} catch {
		// Continue anyway
	}

	onUpdate?.({ content: [{ type: "text", text: "Building project..." }] });

	// Run build command
	if (config.buildCommand) {
		const buildResult = await pi.exec(
			"bash",
			["-c", config.buildCommand],
			{ cwd, signal, timeout: 120000 },
		);
		if (buildResult.code !== 0) {
			return {
				success: false,
				message: `Build failed:\n${buildResult.stderr || buildResult.stdout}`,
			};
		}
	}

	onUpdate?.({ content: [{ type: "text", text: "Deploying to Cloudflare..." }] });

	// Deploy based on type
	if (config.deploymentType === "pages") {
		const deployResult = await pi.exec(
			"wrangler",
			["pages", "deploy", config.outputDirectory || "dist", "--project-name", (await getProjectName(pi, cwd)) || "", "--branch", "main"],
			{
				cwd,
				signal,
				timeout: 300000,
				env: {
					...process.env,
					CLOUDFLARE_API_TOKEN: apiToken,
					CLOUDFLARE_ACCOUNT_ID: accountId,
				},
			},
		);

		if (deployResult.code !== 0) {
			return {
				success: false,
				message: `Deployment failed:\n${deployResult.stderr || deployResult.stdout}`,
			};
		}

		// Parse deployment URL from output
		const urlMatch = deployResult.stdout.match(/(https:\/\/[^\s]+\.pages\.dev)/);
		const deploymentUrl = urlMatch ? urlMatch[1] : undefined;

		return {
			success: true,
			deploymentId: Date.now().toString(),
			url: deploymentUrl,
			message: deploymentUrl
				? `Deployed successfully to ${deploymentUrl}`
				: "Deployed successfully",
		};
	} else {
		// Workers deployment
		const deployResult = await pi.exec(
			"wrangler",
			["deploy"],
			{
				cwd,
				signal,
				timeout: 300000,
				env: {
					...process.env,
					CLOUDFLARE_API_TOKEN: apiToken,
					CLOUDFLARE_ACCOUNT_ID: accountId,
				},
			},
		);

		if (deployResult.code !== 0) {
			return {
				success: false,
				message: `Deployment failed:\n${deployResult.stderr || deployResult.stdout}`,
			};
		}

		return {
			success: true,
			deploymentId: Date.now().toString(),
			message: "Worker deployed successfully",
		};
	}
}

// Main extension
export default function cloudflareExtension(pi: ExtensionAPI) {
	// Register deploy tool
	pi.registerTool({
		name: "cloudflare_deploy",
		label: "Cloudflare Deploy",
		description:
			"Deploy the current project to Cloudflare Pages or Workers. Requires CLOUDFLARE_API_TOKEN environment variable and wrangler.toml configuration.",
		parameters: Type.Object({
			buildCommand: Type.Optional(
				Type.String({
					description: "Build command to run before deployment (e.g., 'npm run build')",
				}),
			),
			outputDirectory: Type.Optional(
				Type.String({
					description: "Directory to deploy (default: 'dist' for Pages)",
				}),
			),
		}),

		async execute(
			toolCallId,
			params,
			signal,
			onUpdate,
			ctx,
		) {
			// Update config with any provided parameters
			if (params.buildCommand) config.buildCommand = params.buildCommand;
			if (params.outputDirectory) config.outputDirectory = params.outputDirectory;

			const result = await deployToCloudflare(pi, ctx.cwd, signal, onUpdate);

			return {
				content: [
					{
						type: "text",
						text: result.success
							? `✅ ${result.message}`
							: `❌ ${result.message}`,
					},
				],
				details: {
					deploymentId: result.deploymentId,
					url: result.url,
					success: result.success,
				},
				isError: !result.success,
			};
		},

		renderCall(args, theme) {
			let text = theme.fg("toolTitle", theme.bold("cloudflare_deploy "));
			if (args.buildCommand) {
				text += theme.fg("dim", `build: "${args.buildCommand}" `);
			}
			if (args.outputDirectory) {
				text += theme.fg("dim", `output: "${args.outputDirectory}"`);
			}
			return new Text(text, 0, 0);
		},

		renderResult(result, { isPartial, expanded }, theme) {
			if (isPartial) {
				return new Text(theme.fg("warning", "Deploying..."), 0, 0);
			}

			if (result.isError) {
				return new Text(theme.fg("error", "❌ Deployment failed"), 0, 0);
			}

			let text = theme.fg("success", "✅ Deployed successfully");
			if (expanded && result.details?.url) {
				text += `\n  ${theme.fg("dim", "URL:")} ${result.details.url}`;
			}
			return new Text(text, 0, 0);
		},
	});

	// Register /cloudflare command with subcommands
	pi.registerCommand("cloudflare", {
		description: "Cloudflare deployment management",
		getArgumentCompletions: (prefix) => {
			const subcommands = ["status", "deploy", "config", "logs", "deployments"];
			const filtered = subcommands.filter((s) => s.startsWith(prefix));
			return filtered.length > 0
				? filtered.map((s) => ({ value: s, label: s }))
				: null;
		},
		handler: async (args, ctx) => {
			const [subcommand, ...rest] = args.trim().split(/\s+/);

			switch (subcommand) {
				case "status":
					await showStatus(ctx);
					break;
				case "deploy":
					await triggerDeploy(ctx);
					break;
				case "config":
					await configureCloudflare(ctx);
					break;
				case "logs":
					await showLogs(ctx, rest[0]);
					break;
				case "deployments":
					await listDeployments(ctx);
					break;
				default:
					ctx.ui.notify(
						"Usage: /cloudflare [status|deploy|config|logs|deployments]",
						"warning",
					);
			}
		},
	});

	// Status subcommand
	async function showStatus(ctx: ExtensionContext) {
		const hasWrangler = await checkWrangler(pi);
		const apiToken = getApiToken();
		const accountId = await getAccountId(pi, ctx.cwd);
		const projectName = await getProjectName(pi, ctx.cwd);

		const lines = [
			theme => theme.fg("accent", theme.bold("Cloudflare Status")),
			"",
			`Wrangler CLI: ${hasWrangler ? "✅ Installed" : "❌ Not found"}`,
			`API Token: ${apiToken ? "✅ Configured" : "❌ Not set (CLOUDFLARE_API_TOKEN)"}`,
			`Account ID: ${accountId || "❌ Not configured"}`,
			`Project: ${projectName || "❌ Not found"}`,
			`Deployment Type: ${config.deploymentType}`,
		];

		for (const line of lines) {
			const text = typeof line === "function" ? line(ctx.ui as any) : line;
			ctx.ui.notify(text, "info");
		}
	}

	// Deploy subcommand
	async function triggerDeploy(ctx: ExtensionContext) {
		ctx.ui.notify("Starting deployment...", "info");

		const result = await deployToCloudflare(pi, ctx.cwd);

		if (result.success) {
			ctx.ui.notify(result.message, "success");
			if (result.url) {
				ctx.ui.notify(`URL: ${result.url}`, "info");
			}
		} else {
			ctx.ui.notify(result.message, "error");
		}
	}

	// Config subcommand
	async function configureCloudflare(ctx: ExtensionContext) {
		const accountId = await ctx.ui.input(
			"Cloudflare Account ID:",
			config.accountId || "",
		);
		if (accountId !== undefined) {
			config.accountId = accountId || undefined;
		}

		const projectName = await ctx.ui.input(
			"Project Name (optional):",
			config.projectName || "",
		);
		if (projectName !== undefined) {
			config.projectName = projectName || undefined;
		}

		const deploymentType = await ctx.ui.select("Deployment Type:", [
			"pages",
			"workers",
		]);
		if (deploymentType) {
			config.deploymentType = deploymentType as "pages" | "workers";
		}

		const buildCommand = await ctx.ui.input(
			"Build Command:",
			config.buildCommand || "npm run build",
		);
		if (buildCommand !== undefined) {
			config.buildCommand = buildCommand;
		}

		const outputDir = await ctx.ui.input(
			"Output Directory:",
			config.outputDirectory || "dist",
		);
		if (outputDir !== undefined) {
			config.outputDirectory = outputDir;
		}

		ctx.ui.notify("Configuration saved", "success");
	}

	// Logs subcommand
	async function showLogs(ctx: ExtensionContext, deploymentId?: string) {
		const apiToken = getApiToken();
		if (!apiToken) {
			ctx.ui.notify("CLOUDFLARE_API_TOKEN not set", "error");
			return;
		}

		const accountId = await getAccountId(pi, ctx.cwd);
		if (!accountId) {
			ctx.ui.notify("Account ID not configured", "error");
			return;
		}

		const projectName = await getProjectName(pi, ctx.cwd);
		if (!projectName) {
			ctx.ui.notify("Project name not found", "error");
			return;
		}

		if (deploymentId) {
			// Show specific deployment logs
			const result = await pi.exec(
				"wrangler",
				["pages", "deployment", "get", deploymentId],
				{
					cwd: ctx.cwd,
					timeout: 30000,
					env: {
						...process.env,
						CLOUDFLARE_API_TOKEN: apiToken,
						CLOUDFLARE_ACCOUNT_ID: accountId,
					},
				},
			);

			if (result.code === 0) {
				ctx.ui.notify(result.stdout, "info");
			} else {
				ctx.ui.notify(result.stderr || "Failed to get logs", "error");
			}
		} else {
			// Show recent deployments
			const result = await pi.exec(
				"wrangler",
				["pages", "deployment", "list"],
				{
					cwd: ctx.cwd,
					timeout: 30000,
					env: {
						...process.env,
						CLOUDFLARE_API_TOKEN: apiToken,
						CLOUDFLARE_ACCOUNT_ID: accountId,
					},
				},
			);

			if (result.code === 0) {
				ctx.ui.notify(result.stdout, "info");
			} else {
				ctx.ui.notify(result.stderr || "Failed to list deployments", "error");
			}
		}
	}

	// List deployments subcommand
	async function listDeployments(ctx: ExtensionContext) {
		await showLogs(ctx);
	}

	// Session start - show welcome message if configured
	pi.on("session_start", async (_event, ctx) => {
		const apiToken = getApiToken();
		if (!apiToken) {
			ctx.ui.notify(
				"Cloudflare: CLOUDFLARE_API_TOKEN not set. Run /cloudflare config to configure.",
				"warning",
			);
		}
	});
}
