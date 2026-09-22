# NiakGPT 0.9.102 — Complete Project Memory inventory

## Field evidence

The private vault was active but still incomplete: 17 Projects, 316 known conversations, 310 cached conversations, no archived conversation files, and 16 polluted Project labels. The NiakGPT Project alone reported `indexed=true` while remaining at 30 known vs 24 cached conversations.

## Fixes

- treat `indexed=true` as insufficient when known chat count is higher than cached chat count;
- request a targeted Project-conversation inventory repair before archival;
- allow only that explicit Project Memory inventory request beside an idle peer chat;
- close the exception immediately when the peer becomes busy/generating;
- keep the Project Memory queue alive while any count gap remains;
- sanitize Project names in cache recovery, Project checkpoints, and root `PROJECTS.json`;
- preserve already archived transcripts during metadata bootstrap.

## Upgrade

The manifest keeps the same fixed extension key. Updating the existing unpacked extension in place and pressing **Reload** preserves Chrome extension storage, including the GitHub App configuration. Removing the extension first can clear that storage and require reconnecting GitHub.

## Verification

Release-critical tests reproduce the indexed-but-incomplete state, recover the missing chat, archive it, verify the idle-peer network exception and active-peer quarantine, preserve existing archives, and reject polluted Project names.
