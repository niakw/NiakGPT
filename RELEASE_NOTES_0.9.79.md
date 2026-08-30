# NiakGPT 0.9.79 — GitHub sign-in for private Project Memory

Project Memory now uses a normal GitHub authorization flow as its default setup.

## What changed

- Click **Se connecter avec GitHub** in the Control Center.
- GitHub creates/authorizes a private connector for this browser profile.
- GitHub shows its native repository access screen, including **Only select repositories**.
- NiakGPT then lists the authorized private repositories and lets the user select the vault.
- No PAT copy/paste is required for the normal flow.
- Manual fine-grained PAT setup remains under **Avancé · PAT manuel**.

## Security model

NiakGPT still has no backend and no shared GitHub client secret. The public repository and its GitHub Actions never receive the private vault name or credentials.

The per-user GitHub App requests only:

- **Contents: write**
- **Metadata: read**

The current user access token lives in browser session storage. Refresh material and the per-user App client secret remain local to the browser profile. The private PEM returned when GitHub creates the App is discarded and never persisted.

Repository selection is enforced twice: GitHub controls the installation repositories, and NiakGPT rejects any vault not returned by the authorized installation API.

## Compatibility

Existing PAT-based Project Memory configurations continue to work. Repositories with no commits can still be initialized automatically.
