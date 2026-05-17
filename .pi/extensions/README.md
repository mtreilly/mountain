# Cloudflare Deployment Extension for pi

Deploy projects to Cloudflare Pages and Workers directly from pi.

## Features

- **Deploy Tool**: `cloudflare_deploy` - Deploy with automatic build and upload
- **Commands**: `/cloudflare [status|deploy|config|logs|deployments]`
- **Authentication**: Uses `CLOUDFLARE_API_TOKEN` environment variable
- **Project Detection**: Auto-detects project from `wrangler.toml` or `package.json`

## Setup

### 1. Install Wrangler

```bash
npm install -g wrangler
```

### 2. Configure Authentication

Set your Cloudflare API token:

```bash
export CLOUDFLARE_API_TOKEN="your-api-token"
```

Add to your shell profile (`~/.bashrc`, `~/.zshrc`, etc.) for persistence.

**Creating an API Token:**
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)
2. Click "Create Token"
3. Use the "Cloudflare Pages" or "Edit Cloudflare Workers" template
4. Copy the token

### 3. Configure Your Project

Ensure you have a `wrangler.toml`:

```bash
wrangler init
```

Or configure manually with `/cloudflare config`.

## Usage

### Using the Tool

Ask pi to deploy:

```
Deploy this project to Cloudflare
```

Or use the tool directly:

```
Use cloudflare_deploy with buildCommand="npm run build" and outputDirectory="dist"
```

### Using Commands

- `/cloudflare status` - Check configuration and authentication
- `/cloudflare deploy` - Trigger deployment
- `/cloudflare config` - Configure deployment settings
- `/cloudflare logs` - View recent deployment logs
- `/cloudflare logs <id>` - View specific deployment logs
- `/cloudflare deployments` - List all deployments

### Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| Account ID | Auto-detected | Cloudflare account ID |
| Project Name | Auto-detected | Cloudflare Pages project name |
| Deployment Type | `pages` | `pages` or `workers` |
| Build Command | `npm run build` | Command to build before deploy |
| Output Directory | `dist` | Directory to deploy |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CLOUDFLARE_API_TOKEN` | Yes | Cloudflare API token |
| `CLOUDFLARE_ACCOUNT_ID` | No | Cloudflare account ID (can be configured) |

## Troubleshooting

### "CLOUDFLARE_API_TOKEN not set"

Export your API token:

```bash
export CLOUDFLARE_API_TOKEN="your-token"
```

### "No wrangler.toml found"

Initialize your project:

```bash
wrangler init
```

### "Build failed"

Check your build command in `/cloudflare config` or `package.json`.

### "Account ID not found"

Set it explicitly:

```bash
export CLOUDFLARE_ACCOUNT_ID="your-account-id"
```

Or configure via `/cloudflare config`.

## Requirements

- Wrangler CLI installed
- Valid Cloudflare API token
- `wrangler.toml` configuration file
- Cloudflare Pages project created

## See Also

- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)
