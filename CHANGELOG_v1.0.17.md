# Changelog v1.0.17

## Documentation Updates

### Pricing Page (`docs/pricing.md`)
- ✅ Added detailed pricing table with 4 tiers:
  - **Free:** 100 memories, 1 API key, 1 sync/min, $0
  - **Starter:** 1,000 memories, 1 API key, unlimited sync, $5/mo
  - **Developer:** 10,000 memories, 3 API keys, unlimited sync, $15/mo
  - **Team:** 50,000 memories, 10 API keys, unlimited sync, $50/mo
- ✅ Updated comparison table (self-hosted vs cloud)
- ✅ Added self-hosted quota management instructions

### FAQ (`docs/faq.md`)
- ✅ Added "Cloud quotas" section with 7 FAQ entries
- ✅ Explained quota behavior and selection prompts
- ✅ Listed specific tier limits (100 / 1K / 10K / 50K)
- ✅ Added self-hosted quota disable instructions

### Cloud Quickstart (`docs/cloud-quickstart.md`)
- ✅ Added free tier limits tip box
- ✅ Added quota handling information
- ✅ Cross-linked to pricing and FAQ

### CLI Reference (`docs/cli-reference.md`)
- ✅ Enhanced `dim sync` documentation
- ✅ Explained selection prompts and strategies
- ✅ Clarified update vs new memory behavior

## Changes Summary

**What's New:**
- Complete documentation for cloud quota management
- Tiered pricing clearly documented (100 / 1K / 10K / 50K memories)
- Self-hosted quota management instructions
- User-friendly explanations of quota behavior

**What's NOT Changed:**
- No code changes in this release
- Schema v10 foundation exists but sync client refactor incomplete
- Quota enforcement not yet active in CLI (server-ready, client pending)

## Publishing Notes

**Version:** 1.0.16 → 1.0.17  
**Type:** Documentation-only update  
**Breaking Changes:** None  
**Requires:** No migration needed

**Safe to publish:** ✅ Yes - Documentation only, no code changes

## Next Release (v1.1.0)

Will include:
- Sync client refactor with per-item tracking
- Interactive selection UI for quota limits
- Full quota management integration
- CLI flags: `--select`, `--json`

---

**Date:** 2026-07-25  
**Status:** Ready for npm publish
