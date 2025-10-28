# Origo Bot Installation Guide

## Quick Installation Steps

### 1. Create GitHub App

Go to: **https://github.com/settings/apps/new**

**Basic Information:**
```
Name: Origo
Description: Production-grade automation bot for Origo Stack microservices platform
Homepage URL: https://github.com/souravs72/OrigoStack
Setup URL: https://github.com/souravs72/OrigoStack/wiki/Origo-Bot-Setup
Webhook URL: https://github.com/souravs72/OrigoStack/settings/hooks
```

**Upload Avatar:**
- Upload: `.github/origo-bot/avatar.gif` from this repository

### 2. Set Repository Permissions

```
☑️ Actions: Read & write
☑️ Checks: Write
☑️ Contents: Write
☑️ Deployments: Write
☑️ Environments: Write
☑️ Issues: Write
☑️ Metadata: Read
☑️ Pull requests: Write
☑️ Security events: Write
☑️ Statuses: Write
☑️ Vulnerability alerts: Read
```

**Account Permissions:**
```
☑️ Members: Read
```

### 3. Subscribe to Events

```
☑️ Check run            ☑️ Pull request review
☑️ Check suite          ☑️ Pull request review comment
☑️ Code scanning alert  ☑️ Push
☑️ Create              ☑️ Release
☑️ Dependabot alert    ☑️ Repository
☑️ Deployment          ☑️ Repository vulnerability alert
☑️ Deployment status   ☑️ Security advisory
☑️ Issues              ☑️ Workflow run
☑️ Issue comment
☑️ Pull request
```

### 4. Install on Repository

1. After creating app, click **"Install App"**
2. Select **"Only select repositories"**
3. Choose: **souravs72/OrigoStack**
4. Click **"Install"**

### 5. Configure Repository Secrets

Go to: **https://github.com/souravs72/OrigoStack/settings/secrets/actions**

Add these secrets:

| Secret Name | How to Get |
|-------------|------------|
| `ORIGO_APP_ID` | App Settings → General → About section |
| `ORIGO_PRIVATE_KEY` | App Settings → Private keys → Generate new key |
| `ORIGO_INSTALLATION_ID` | https://github.com/settings/installations → Click Origo → Get ID from URL |

### 6. Verify Installation

Once configured, create a test PR and you should see:
- Comments from "Origo" (not github-actions)
- Origo avatar in comments
- Risk assessment with setup PR detection

## Troubleshooting

**Still showing "github-actions" instead of "Origo"?**
- Ensure all secrets are properly configured
- Check that the app is installed on the repository
- Verify the private key is the complete PEM content including headers

**App not responding to PRs?**
- Check webhook events are properly subscribed
- Verify app has necessary permissions
- Check repository secrets are correctly named

**Need help?**
- Check the logs in Actions tab
- Verify app installation status
- Ensure webhook URL is accessible

---

**After installation, the bot will automatically:**
- Assess PR risk levels with setup detection
- Apply appropriate labels
- Route to correct reviewers
- Run quality gates
- Monitor for security issues
- Enable smart auto-merge for low-risk PRs

The Origo bot is designed to reduce manual overhead while maintaining production security standards.
