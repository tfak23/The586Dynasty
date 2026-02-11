# GitHub Workflows Examples

This directory contains example GitHub Actions workflows that can be used with this project.

## Available Examples

### deploy-edge-functions.yml

Automatically deploys Supabase Edge Functions when changes are pushed to the `main` branch.

**To use:**

1. Copy to `.github/workflows/`:
   ```bash
   cp .github-workflows-example/deploy-edge-functions.yml .github/workflows/
   ```

2. Set up GitHub Secrets:
   - Go to your GitHub repository → Settings → Secrets and variables → Actions
   - Add the following secrets:
     - `SUPABASE_ACCESS_TOKEN`: Create in [Supabase Dashboard](https://app.supabase.com) → Account → Access Tokens
     - `SUPABASE_PROJECT_REF`: Your project reference ID (found in Project Settings → General)

3. Commit and push:
   ```bash
   git add .github/workflows/deploy-edge-functions.yml
   git commit -m "Add Edge Functions deployment workflow"
   git push
   ```

4. The workflow will automatically trigger when you push changes to `supabase/functions/**`

## Notes

- These are examples and may need customization for your specific needs
- Always test workflows on a separate branch first
- Keep your GitHub Secrets secure and never commit them to the repository
- Review the [GitHub Actions documentation](https://docs.github.com/en/actions) for more information
