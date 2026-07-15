# Contributing to Flexshot

Thanks for helping improve Flexshot! This guide explains how to set up the project, make changes, and open a pull request on GitHub.

**Repository:** https://github.com/salesbotics/flexshot

---

## Code of conduct

Be respectful and constructive. Harassment or discriminatory behavior is not tolerated. Maintainers may close issues or PRs that violate this.

---

## Ways to contribute

- Report bugs and request features via [Issues](https://github.com/salesbotics/flexshot/issues)
- Fix bugs or ship small UX improvements
- Improve documentation (`README.md`, `CONTRIBUTING.md`, comments)
- Improve annotation tools, capture reliability, recording, or PDF export
- Polish the popup / on-page launcher / marketing page

If you plan a large change, open an issue first so we can align on approach.

---

## Development setup

### 1. Fork and clone

```bash
git clone git@github.com:YOUR_USERNAME/flexshot.git
cd flexshot
git remote add upstream git@github.com:salesbotics/flexshot.git
```

(Maintainers cloning the main repo can use `git@github.com:salesbotics/flexshot.git` directly.)

### 2. Load the extension in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select your local `flexshot` folder
4. After code changes, click **Reload** on the extension card

### 3. Test on a normal page

Use a regular site (e.g. `https://example.com`).  
Capture does **not** work on `chrome://`, Web Store, or other restricted pages.

---

## Branch naming

| Prefix | Use |
|--------|-----|
| `feat/` | New feature |
| `fix/` | Bug fix |
| `docs/` | Documentation only |
| `refactor/` | Internal cleanup |
| `chore/` | Tooling, ignore files, version bumps |

Examples: `feat/arrow-tool-snap`, `fix/fullpage-stitch-gap`, `docs/contributing`

---

## Making changes

1. Create a branch from `main`:
   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main   # if you use a fork
   git checkout -b feat/my-change
   ```
2. Keep changes focused — one concern per PR when possible.
3. Match existing style in the area you edit (vanilla JS, clear names, small helpers).
4. Avoid drive-by refactors unrelated to your PR.
5. Reload the extension and manually verify the flow you touched.

### Suggested manual test checklist

- [ ] Popup tabs: **Screenshot**, **Record**, **More** open and look correct
- [ ] Selected area / visible / full page capture open the editor
- [ ] Annotation: draw, text, arrow, undo, download PNG
- [ ] Screen record starts/stops and downloads (if you changed recording)
- [ ] Web → PDF downloads (if you changed PDF / full-page stitch)
- [ ] On-page launcher (“Open on page”) still works
- [ ] No console errors in the service worker or popup (`chrome://extensions` → service worker “Inspect”)

---

## Commit messages

Prefer short, imperative messages:

```text
fix: stitch last slice of full-page capture correctly
feat: remember last popup tab
docs: add contributing guide
```

Explain *why* in the body when the change is non-obvious.

---

## Pull requests

1. Push your branch:
   ```bash
   git push -u origin feat/my-change
   ```
2. Open a PR against `salesbotics/flexshot` → `main`
3. Fill in:
   - **What** changed
   - **Why**
   - **How you tested** (checklist above)
4. Link related issues (`Fixes #123`)
5. Keep the PR up to date with `main` if requested

A maintainer will review, request changes if needed, and merge.

---

## Project map (where to edit)

| Area | Path |
|------|------|
| Manifest / permissions | `manifest.json` |
| Capture orchestration | `src/background/service-worker.js` |
| Popup UI (Capture / Record tabs) | `src/popup/` |
| Region select / full page / launcher | `src/content/` |
| Annotation editor | `src/editor/` |
| Screen recorder | `src/record/` |
| Crop / stitch / PDF | `src/offscreen/` |
| Landing / store copy | `marketing/` |

---

## Reporting bugs

Include:

- Chrome version and OS
- Flexshot version (`manifest.json` → `version`)
- Steps to reproduce
- Expected vs actual behavior
- Screenshots or console errors (service worker + page)

---

## Security / privacy

Do not add telemetry, analytics, or upload of user captures unless discussed and clearly disclosed. Prefer local-only processing.

If you discover a security issue that could expose user media or inject into pages, email the maintainers or open a **private** security advisory on GitHub instead of a public issue when possible.

---

## License

By contributing, you agree that your contributions are licensed under the same [MIT License](LICENSE) as the project.

---

## First-time push of this repo (maintainers)

```bash
cd flexshot
git init
git add .
git commit -m "Initial commit: Flexshot Chrome extension"
git remote add origin git@github.com:salesbotics/flexshot.git
git branch -M main
git push -u origin main
```

Thanks again — every PR helps make Flexshot better.
