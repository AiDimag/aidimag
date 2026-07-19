# NPM Publishing Checklist

## Pre-Publish Requirements

### 1. Package Configuration ✅
- [x] `package.json` has correct name: `aidimag`
- [x] Version is set (currently `1.0.0`)
- [x] Description is clear and concise
- [x] License field is set: `SEE LICENSE IN LICENSE`
- [x] Repository URL is correct: `https://github.com/anupkhanal/aidimag`
- [x] Homepage and bugs URLs are set
- [x] Keywords are relevant for discoverability
- [x] `files` array includes only `dist/`, `LICENSE`, `README.md`
- [x] `files` array excludes `dist/test` and source maps
- [x] Binary executables defined: `dim` and `aidimag`
- [x] Main entry point: `./dist/index.js`
- [x] TypeScript declarations: `./dist/index.d.ts`
- [x] Node engine requirement: `>=18`

### 2. Build Configuration ✅
- [x] TypeScript compiles successfully (`npm run build`)
- [x] Output directory is `dist/`
- [x] Declaration files (`.d.ts`) are generated
- [x] Source maps are excluded from package

### 3. Files to Publish ✅
**Included:**
- `dist/` folder (compiled JavaScript + type declarations)
- `LICENSE` file
- `README.md` file

**Excluded (via .npmignore):**
- `src/` (TypeScript source)
- `docs/` (documentation site)
- `vscode-extension/` and `intellij-plugin/`
- `.github/` workflows
- Test files
- Development scripts

### 4. Testing ✅
- [x] Tests pass: `npm test`
- [x] Package can be built: `npm run build`
- [x] Dry-run packaging works: `npm pack --dry-run`

### 5. NPM Account Setup ⚠️ TODO
- [ ] Create/login to npm account
- [ ] Enable 2FA on npm account (required for publishing)
- [ ] Generate npm access token with publish permissions
- [ ] Add `NPM_TOKEN` to GitHub repository secrets

### 6. Version Management 📋 TODO
- [ ] Decide on initial version (currently `1.0.0`)
- [ ] Follow semantic versioning (semver.org)
- [ ] Create git tag for version (e.g., `v1.0.0`)

### 7. Documentation 📋 TODO
- [ ] Verify README.md has installation instructions
- [ ] Verify README.md has usage examples
- [ ] Verify README.md mentions the CLI commands
- [ ] Check that LICENSE file is included

### 8. GitHub Release 📋 TODO
- [ ] Create a GitHub release with tag (e.g., `v1.0.0`)
- [ ] Add release notes describing features
- [ ] Publishing workflow will trigger automatically on release

## Publishing Methods

### Method 1: Via GitHub Release (Recommended)
1. Create a git tag: `git tag v1.0.0`
2. Push tag: `git push origin v1.0.0`
3. Create GitHub release from the tag
4. Workflow will automatically publish to npm

### Method 2: Manual Workflow Trigger
1. Go to Actions → Publish to npm
2. Click "Run workflow"
3. Enter the tag name (e.g., `v1.0.0`)
4. Click "Run workflow"

### Method 3: Local Publishing (Not Recommended)
```bash
npm login
npm publish --access public
```

## Verification After Publishing

- [ ] Check package on npm: `https://www.npmjs.com/package/aidimag`
- [ ] Test installation: `npm install -g aidimag`
- [ ] Test CLI commands: `dim --version`, `aidimag --version`
- [ ] Verify package contents don't include source files
- [ ] Check that type declarations are available

## Package Size

Current package size: **~169 KB** (compressed)
Unpacked size: **~595 KB**

## Important Notes

1. **No source code in package**: Only compiled `dist/` folder is published
2. **License**: Elastic License 2.0 - free for teams ≤10 users
3. **Provenance**: Workflow uses `--provenance` flag for supply chain security
4. **Access**: Package is public (`--access public`)
5. **Tests run before publish**: `prepublishOnly` script ensures build and tests pass

## Next Steps

1. Set up NPM_TOKEN in GitHub secrets
2. Review and update README.md if needed
3. Create v1.0.0 release on GitHub
4. Monitor the publish workflow
5. Verify package on npmjs.com
