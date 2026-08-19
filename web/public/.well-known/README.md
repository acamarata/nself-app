# .well-known — Digital Asset Links / Universal Links

Served verbatim at `https://task.nself.org/.well-known/*`. Do not add files here
that aren't meant to be publicly fetchable by OS-level link-verification agents.

## assetlinks.json — Android App Links

`sha256_cert_fingerprints` is intentionally `[]` as of 2026-08-16. **This is a
required pre-launch step, not an oversight:**

- No ɳTask Android build has ever completed successfully. `eas.json` uses
  `credentialsSource: "remote"`, so EAS generates/holds the signing keystore —
  it does not exist until the first successful `eas build --platform android
  --profile production` run. Every `Android Release (EAS)` GitHub Actions run
  to date (workflow `ntask/.github/workflows/android-release.yml`) has failed
  before reaching a signed artifact (EAS_TOKEN / Google service account
  external gates not yet provisioned — see the workflow's `C-S8-T2` reference).
- Populating this file with a fake or guessed fingerprint would be worse than
  leaving it empty: Android would silently trust a cert that can never match,
  which is indistinguishable from "not configured" but harder to audit.

**Before shipping the first Android build:** run `eas credentials` (or pull
from Google Play Console → App integrity → App signing) to get the release
SHA-256 cert fingerprint, then update `sha256_cert_fingerprints` in
`assetlinks.json` in the same PR that ships the Play Store listing.

**Enforcement:** `android-release.yml` has a `Verify Digital Asset Links
fingerprint` step that fails the workflow before `eas submit` if the
production `assetlinks.json` still has an empty `sha256_cert_fingerprints`
array — so a real Android release cannot go out with deep links silently
broken. If that step ever needs to be bypassed, this file is stale and should
be deleted or updated in the same PR.
