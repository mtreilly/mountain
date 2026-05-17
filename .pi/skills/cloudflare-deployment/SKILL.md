# Cloudflare Deployment Skill

Use this skill when the user wants to deploy a project to Cloudflare Pages or Workers.

## When to Use

- User asks to "deploy to Cloudflare"
- User mentions "publish to Pages"
- User wants to "deploy the site"
- User asks about wrangler deployment

## Prerequisites Check

Before deploying, ensure:

1. **Wrangler CLI** is available: Check with `wrangler --version`
2. **API Token** is set: Check `CLOUDFLARE_API_TOKEN` environment variable
3. **wrangler.toml** exists: Check if the file is present
4. **Build works**: Run the build command locally first

## Deployment Process

### Step 1: Check Configuration

Run the status command to check configuration:

```
/cloudflare status
```

Or check manually:
- `echo $CLOUDFLARE_API_TOKEN` - Should not be empty
- `cat wrangler.toml` - Should exist and be valid
- `wrangler pages project get` - Should show project info

### Step 2: Build the Project

If a build step is needed:

```bash
npm run build
```

Or the appropriate build command for the project.

### Step 3: Deploy

Use the deployment tool:

```
Use cloudflare_deploy to deploy the project
```

Or use the command:

```
/cloudflare deploy
```

### Step 4: Verify

Check the deployment:

```
/cloudflare deployments
```

Visit the deployment URL shown in the output.

## Common Issues

### Missing API Token

If `CLOUDFLARE_API_TOKEN` is not set:

1. Tell the user to create a token at https://dash.cloudflare.com/profile/api-tokens
2. Export it: `export CLOUDFLARE_API_TOKEN="token"`
3. Retry deployment

### Missing wrangler.toml

If no `wrangler.toml` exists:

1. Run `wrangler init` to create one
2. Or configure manually with `/cloudflare config`

### Build Failures

If the build fails:

1. Check `package.json` scripts
2. Run build manually: `npm run build`
3. Fix any errors
4. Retry deployment

### Account ID Issues

If account ID is not found:

1. Get it from the Cloudflare dashboard (right sidebar)
2. Export: `export CLOUDFLARE_ACCOUNT_ID="id"`
3. Or configure with `/cloudflare config`

## Project Types

### Static Sites (Pages)

- Build command: `npm run build` or custom
- Output directory: `dist`, `build`, or custom
- Deployment: `wrangler pages deploy <directory>`

### React/Vite Projects

- Usually `npm run build`
- Output: `dist/` folder
- Entry point: `index.html`

### Workers

- Deployment: `wrangler deploy`
- No build step required for simple workers
- Uses `wrangler.toml` configuration

## Best Practices

1. **Always test build locally** before deploying
2. **Check environment variables** are set correctly
3. **Verify the project name** matches Cloudflare Pages project
4. **Use branches** for staging/production deployments
5. **Check deployment logs** if something goes wrong

## Commands Reference

| Command | Purpose |
|---------|---------|
| `/cloudflare status` | Check configuration |
| `/cloudflare deploy` | Trigger deployment |
| `/cloudflare config` | Configure settings |
| `/cloudflare logs` | View logs |
| `/cloudflare deployments` | List deployments |

## Tool Reference

**cloudflare_deploy**

Parameters:
- `buildCommand` (optional): Build command to run
- `outputDirectory` (optional): Directory to deploy

Example:
```
Use cloudflare_deploy with buildCommand="npm run build" and outputDirectory="dist"
```
