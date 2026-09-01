## 0.9.92 — morphologie terrain sans titre Projects

- Le fixture `field-sidebar-cache-recovery-v090.mjs` reproduit maintenant une sidebar où des chats récents précèdent des lignes Project sans titre « Projects » et sans href Project.
- Le test exige que les Pins soient réellement siblings avant le bloc natif et que `data-ng121-placement` vaille `native-projects`, y compris après remount React.
- La validation statique courante interdit explicitement à NiakGPT de référencer `/backend-api/f/conversation/resume`; un 410 sur cette route vient donc du flux natif ChatGPT, pas d’un appel NiakGPT.

## 0.9.91 — remount React tardif réellement reproduit

- Le lab `field-sidebar-cache-recovery-v090.mjs` charge désormais aussi `ux-v131.css/js` dans l’ordre du runtime de production, vérifie que le fallback est réellement visible, remplace ensuite toute la sidebar par un clone sans `#ng8-pins` pour reproduire un remount React tardif, puis exige la recréation automatique des 5 Projects locaux au-dessus de Projects/Chats avec zéro RPC ChatGPT.
- Le même scénario poursuit jusqu’à l’upgrade canonique et vérifie alors le passage propre à l’autorité NiakGPT.
- Le diagnostic `projects-authority` distingue maintenant un fallback local volontaire d’un bloc Pins réellement absent.


## 0.9.90 — preuve terrain local-cache + privacy

- `visual-lab/field-sidebar-cache-recovery-v090.mjs` reproduit l’état terrain « cache local présent / gouvernance canonique absente / lignes Projects natives sans liens `g-p-*` » et exige : fallback 5 Projects conservé, Pins avant Projects puis Chats, surface native visible, zéro RPC ChatGPT, puis bascule vers l’autorité NiakGPT après upgrade canonique.
- `tools/check-public-tree-privacy-v134.mjs` scanne tout l’arbre texte suivi par Git et échoue en présence de marqueurs privés connus, d’e-mails réels, de chemins utilisateur locaux ou de secrets plausibles.
- Ces tests restent synthétiques : ils prouvent le contrat du code NiakGPT, pas la stabilité future du DOM/transport du service ChatGPT sur un compte authentifié réel.
# NiakGPT testing truth

NiakGPT uses several evidence levels. Their names must describe what they **actually prove**.

## Evidence levels

### 1. Static/runtime contract

Syntax, manifest permissions, runtime order, source invariants, documentation/version consistency, repository hygiene and packaging.

This proves the release is internally coherent. It does not prove the current ChatGPT production DOM.

### 2. Browser fixture interaction

Chromium, Firefox and WebKit exercise deterministic ChatGPT-shaped fixtures.

These tests prove interaction logic, geometry, accessibility, remount/BFCache recovery and cross-engine behavior against those fixtures.

### 3. MV3 extension-on-fixture runtime

The actual unpacked Manifest V3 extension is loaded into real Chromium/Brave processes while ChatGPT document/network behavior is controlled by the test fixture.

This proves bootstrap, content-script order and browser integration. It still does not prove compatibility with every current authenticated ChatGPT revision.

### 4. Authenticated live evidence

Only a real authenticated ChatGPT session, observed manually or through an explicitly authenticated live test, can certify the current production DOM.

CI intentionally has no user authentication and must never label fixture evidence as live production certification.

## Release rule

A user screenshot or reproducible authenticated behavior that contradicts a green fixture is a **release-blocking regression signal**.

The correct response is:

1. reproduce the observed production shape in a deterministic fixture;
2. fix the runtime;
3. make the new regression test pass;
4. re-run the relevant cross-engine/MV3 matrix.

Do not weaken the fixture to match the bug.

## Legacy naming warning

Historical filenames/workflow labels containing words such as `human`, `real extension` or `live` do not upgrade the evidence level by themselves.

Evidence classification depends on what the test really loads.

## Current high-value gates

The 0.9.76/v131 line explicitly covers:

- verified left-sidebar placement;
- Project catalogue scroll ownership and active user-scroll priority;
- Project/chat action remounts and hit-testing;
- BFCache observer recovery;
- parallel continuation residue cleanup;
- user-modified draft protection;
- long-run watchdog safety;
- quiet home-shell behavior;
- Chromium/Firefox/WebKit experience;
- Linux/Windows/macOS runtime paths;
- focused macOS Brave stable MV3 behavior.

## Recovery baseline rule

The 0.9.71–0.9.73 overlay stack is not a stable baseline. A recovery release must not reintroduce `native-ux-v125/v126`, `continuity-limit-v125`, `continuity-live-v126`, `sidebar-route-placement-v125` or `sidebar-truth-v127` without a new authenticated validation cycle.

Fixture CI alone cannot authorize their return.

## Native chat network safety baseline — 0.9.88

A synthetic browser lab is **not** proof that an authenticated production ChatGPT account will never encounter a platform-side network incident. It can, however, prove what NiakGPT itself does or does not emit.

The mandatory regression baseline is therefore explicit:

- loading NiakGPT on a `/c/{id}` conversation must emit **zero NiakGPT ChatGPT-backend traffic**, not merely zero automatic GET;
- foreground Project reads and NiakGPT-owned PATCH/POST/DELETE are also quarantined for the full lifetime of a visible conversation;
- Project Memory, server indexing, recovery, governance and deep analysis cannot bypass that route guard;
- a visible peer conversation applies the same absolute quarantine in other ChatGPT tabs/windows;
- off-chat foreground Project reads remain possible only when no visible peer conversation and no native busy/verification/network state exists;
- CI success must never be described as authenticated live-field proof unless an authenticated live test actually ran.

The field reports that motivated 0.9.87 and 0.9.88 is treated as higher-priority evidence than a green synthetic gate when the two disagree.

## Combined field regression — 0.9.88

`visual-lab/field-regressions-v088.mjs` reproduces the three field failures together: an expanded native Project subtree, absolute current/peer conversation network quarantine, and immediate GitHub files from local cache. Green fixture evidence still does not replace an authenticated field check.
