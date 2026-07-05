# GitHub Initial MVP Release Checklist

Use this checklist before the first public GitHub push.

## Required

- [ ] README explains the product in 30 seconds.
- [ ] README has no mojibake or broken encoding text.
- [ ] `.gitignore` excludes local caches, virtualenvs, raw private data, and generated outputs.
- [ ] `LICENSE` exists.
- [ ] Generated files are not included in the initial commit unless intentionally curated.
- [ ] Private raw exports are not included.
- [ ] Secrets/API keys are not included.
- [ ] Public sanitized example exists at `examples/session.state.example.json`.
- [ ] `session_state.py` still runs locally.
- [ ] Companion mock opens from `companion/index.html`.
- [ ] OpenCode PoC files are present under `integrations/opencode/`.

## Recommended Verification

- [ ] Run CLI help or a known local representation:

```powershell
python session_state.py --help
```

- [ ] Run the sanitized public example:

```powershell
python session_state.py `
  --input examples/session.state.example.json `
  --format markdown
```

- [ ] Generate a handoff prompt from the sanitized public example:

```powershell
python session_state.py `
  --input examples/session.state.example.json `
  --resume
```

- [ ] Open:

```text
companion/index.html
```

- [ ] Check:

```text
integrations/opencode/
```

## Staging Safety Check

- [ ] Check repository status:

```powershell
git status --short
```

- [ ] Confirm private/generated paths are ignored:

```powershell
git check-ignore -v raw_data/
git check-ignore -v outputs/
git check-ignore -v reports/
git check-ignore -v .venv/
```

- [ ] Preview what would be added:

```powershell
git add --dry-run .
```

- [ ] Confirm these paths are not staged:

```text
raw_data/
outputs/
reports/
reviews/
viewer/
.venv/
__pycache__/
```

## File Visibility Review

### Large / Noisy File Decision

| Decision | Path / Pattern | Reason |
|---|---|---|
| Keep | `src/session_state/` | Core engine source code. |
| Keep | `session_state.py` | Agent-facing CLI and integration surface. |
| Keep | `companion/` | Main product UX prototype. |
| Keep | `integrations/` | Agent adapter layer and OpenCode PoC. |
| Keep | `docs/` | Product/architecture/research context for early users. |
| Keep | `samples/` | Small fixtures are useful examples and test inputs. |
| Keep | `tests/` | Required for confidence before public release. |
| Keep | `examples/session.state.example.json` | Sanitized public representation example for clean clone Quick Start. |
| Ignore | `.venv/` | Local Python environment; very large and machine-specific. |
| Ignore | `__pycache__/`, `*.pyc` | Generated Python cache files. |
| Ignore | `raw_data/` | May contain private exports and validation conversations. |
| Ignore | `outputs/` | Generated representation batches; large and reproducible. |
| Ignore | `reports/` | Generated validation summaries. |
| Ignore | `reviews/` | Generated human review books. |
| Ignore | `viewer/` | Generated static viewer output, not current product source. |
| Ignore | `evaluation_*.txt` | Local console run artifacts. |
| Archive Later | Phase 0 / Phase 0.5 reports | Valuable history, but too research-heavy for first impression. |
| Archive Later | `viewer/session_viewer.html` | Useful previous prototype; current product center is Companion. |
| Archive Later | raw ChatGPT validation fixtures | Useful for validation after sanitization, risky for public repo. |
| Archive Later | generated representation batches | Useful evidence, but should live outside the main product path. |

### Keep

- [ ] `README.md`
- [ ] `LICENSE`
- [ ] `pyproject.toml`
- [ ] `session_state.py`
- [ ] `src/session_state/`
- [ ] `companion/`
- [ ] `integrations/`
- [ ] `docs/`
- [ ] `samples/`
- [ ] `tests/`

### Ignore

- [ ] `.venv/`
- [ ] `__pycache__/`
- [ ] `.pytest_cache/`
- [ ] `node_modules/`
- [ ] `raw_data/`
- [ ] `outputs/`
- [ ] `reports/`
- [ ] `reviews/`
- [ ] `viewer/`
- [ ] local logs and temporary files

### Archive Later

- [ ] Phase 0 / Phase 0.5 research reports
- [ ] generated review books
- [ ] generated representation batches
- [ ] old viewer output
- [ ] raw ChatGPT validation fixtures after sanitization

## README Review

- [ ] It says this is an agent-agnostic AI Worker Companion.
- [ ] It says what this is not.
- [ ] It shows the core flow:

```text
AI Agent Session -> Session State -> Companion Status -> Human Attention -> Recovery Handoff
```

- [ ] It includes a Quick Start.
- [ ] It mentions local-first/privacy boundaries.
- [ ] It states that the project is a prototype/MVP PoC.

## License Decision

Recommended license: MIT.

Reason:

- This is an early developer tool / integration PoC.
- MIT is simple, familiar, and low-friction for plugin/adapter experimentation.
- It is easier for other agent-tool developers to fork, embed, and adapt.
- Apache-2.0 is stronger when explicit patent protection is a priority, but this project is not currently patent-heavy.
- BSD-3 is also permissive, but MIT is more common for small open-source tooling.

## Release Decision

- [ ] Initial MVP commit is ready.
- [ ] Remaining concerns are documented.
