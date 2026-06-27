# ɳTask Releases

Production builds for ɳTask across all platforms.

---

## Repository

GitHub: [nself-org/ntask](https://github.com/nself-org/ntask)

---

## Platform Status

| Platform | Status | Build Tool | Store |
|---|---|---|---|
| Web SaaS | Active | Vercel (auto-deploy) | task.nself.org |
| Mobile (Android) | EAS pending | EAS / expo-cli | Google Play |
| Mobile (iOS) | EAS pending | EAS / expo-cli | App Store |
| Desktop | Epic E | Tauri 2 | — |
| TV | Epic F | react-native-tvos | — |

---

## Release Commands

| Command | Platform |
|---|---|
| `eas build --platform android --profile production` | Android mobile |
| `eas build --platform ios --profile production` | iOS mobile |
| `vercel deploy --prod` (from web/ntask/) | Web SaaS |

---

## Directory Structure

```
.releases/
├── android/     # Android release notes and sideload instructions
└── README.md    # This file
```

---

## Version Source of Truth

- Mobile: `apps/mobile/package.json`
- Web SaaS: `web/ntask/package.json`
- Canonical: `.claude/docs/MASTER-VERSIONS.md` + SPORT F01
