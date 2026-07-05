# Phase 0.5 Full Human Evaluation

## Executive Summary

Role: independent Human Reviewer. I evaluated the generated representations as an end user, not as the project developer, schema author, or prompt author.

No representation was modified or regenerated. No API call was made.

| Overall | Count |
| --- | ---: |
| PASS | 81 |
| MINOR ISSUE | 31 |
| MAJOR ISSUE | 12 |

Average scores:

| Category | Average |
| --- | ---: |
| Goal Stack | 4.19 / 5 |
| Current Situation | 4.31 / 5 |
| Blocker | 3.68 / 5 |
| Evidence | 5.00 / 5 |
| Human Usability | 4.22 / 5 |

Interpretation: the generated set is usable enough for Phase 0.5 Human Evaluation. The strongest field is Evidence/Current Situation; the weakest and most ambiguous field is Blocker.

## Most Effective Representations TOP 20

These samples were selected for clear session intent, coherent Goal Stack, usable Current Situation, appropriate evidence volume, and handoff value.

| Sample | Records | Scores | Overall | Why |
| --- | ---: | --- | --- | --- |
| `conv_118_e5c1c732b9ae` | 464 | G 5/5 / C 5/5 / B 5/5 / E 5/5 / U 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. Long-session behavior should be checked, especially whether the active goal and blocker are complete. Blocker is marked as Decision/Strategy Blocker; verify whether it truly blocks continuation. |
| `conv_000_d4223b7b84d6` | 125 | G 5/5 / C 5/5 / B 5/5 / E 5/5 / U 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. Long-session behavior should be checked, especially whether the active goal and blocker are complete. Blocker is marked as Hard Blocker; verify whether it truly blocks continuation. |
| `conv_106_c11190b3ccf8` | 36 | G 5/5 / C 5/5 / B 5/5 / E 5/5 / U 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. Blocker is marked as Decision/Strategy Blocker; verify whether it truly blocks continuation. |
| `conv_017_d770cba7f274` | 25 | G 5/5 / C 5/5 / B 5/5 / E 5/5 / U 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. Blocker is marked as Decision/Strategy Blocker; verify whether it truly blocks continuation. |
| `conv_011_da85e38812fd` | 20 | G 5/5 / C 5/5 / B 5/5 / E 5/5 / U 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. Blocker is marked as Decision/Strategy Blocker; verify whether it truly blocks continuation. |
| `conv_030_077f080f145f` | 6 | G 5/5 / C 5/5 / B 5/5 / E 5/5 / U 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. Blocker is marked as Decision/Strategy Blocker; verify whether it truly blocks continuation. The representation is very short. |
| `conv_063_4a61e6155ce2` | 48 | G 5/5 / C 5/5 / B 5/5 / E 5/5 / U 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| `conv_016_037a77078a29` | 46 | G 5/5 / C 5/5 / B 5/5 / E 5/5 / U 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| `conv_005_fa7e362ee49b` | 42 | G 5/5 / C 5/5 / B 5/5 / E 5/5 / U 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| `conv_076_e283946d529f` | 42 | G 5/5 / C 5/5 / B 5/5 / E 5/5 / U 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| `conv_114_920b0aceb9a5` | 40 | G 5/5 / C 5/5 / B 5/5 / E 5/5 / U 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| `conv_112_1cdf5aaacc01` | 39 | G 5/5 / C 5/5 / B 5/5 / E 5/5 / U 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| `conv_108_08173692a25c` | 36 | G 5/5 / C 5/5 / B 5/5 / E 5/5 / U 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| `conv_068_70b85163591c` | 30 | G 5/5 / C 5/5 / B 5/5 / E 5/5 / U 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| `conv_019_234027074c66` | 26 | G 5/5 / C 5/5 / B 5/5 / E 5/5 / U 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| `conv_067_7938b22514d5` | 26 | G 5/5 / C 5/5 / B 5/5 / E 5/5 / U 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| `conv_078_d6ee78430bfd` | 26 | G 5/5 / C 5/5 / B 5/5 / E 5/5 / U 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. The representation is very short. |
| `conv_123_c2c3aa41b8df` | 23 | G 5/5 / C 5/5 / B 5/5 / E 5/5 / U 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| `conv_031_d15fbb45988c` | 22 | G 5/5 / C 5/5 / B 5/5 / E 5/5 / U 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| `conv_084_7d3c01eb3d62` | 22 | G 5/5 / C 5/5 / B 5/5 / E 5/5 / U 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |

## Representations Needing Improvement TOP 20

Most weak samples are extremely short conversations. In these cases the schema asks for more structure than the source conversation can support.

| Sample | Records | Scores | Overall | Why |
| --- | ---: | --- | --- | --- |
| `conv_012_f46fd698b266` | 2 | G 5/5 / C 5/5 / B 5/5 / E 5/5 / U 5/5 | MAJOR ISSUE | Not reliable enough as a standalone handoff; raw conversation review is likely needed. The original session is too short for a rich Goal Stack. Goal Stack is empty or nearly empty. The representation is very short. |
| `conv_100_d85906367670` | 2 | G 5/5 / C 5/5 / B 5/5 / E 5/5 / U 5/5 | MAJOR ISSUE | Not reliable enough as a standalone handoff; raw conversation review is likely needed. The original session is too short for a rich Goal Stack. Goal Stack is empty or nearly empty. The representation is very short. |
| `conv_002_17e9735ba932` | 2 | G 5/5 / C 5/5 / B 5/5 / E 5/5 / U 5/5 | MAJOR ISSUE | Not reliable enough as a standalone handoff; raw conversation review is likely needed. The original session is too short for a rich Goal Stack. The representation is very short. |
| `conv_040_0b8d3b5361f2` | 2 | G 5/5 / C 5/5 / B 5/5 / E 5/5 / U 5/5 | MAJOR ISSUE | Not reliable enough as a standalone handoff; raw conversation review is likely needed. The original session is too short for a rich Goal Stack. The representation is very short. |
| `conv_051_df1d918713fb` | 2 | G 5/5 / C 5/5 / B 5/5 / E 5/5 / U 5/5 | MAJOR ISSUE | Not reliable enough as a standalone handoff; raw conversation review is likely needed. The original session is too short for a rich Goal Stack. The representation is very short. |
| `conv_054_3015ce9999e6` | 2 | G 5/5 / C 5/5 / B 5/5 / E 5/5 / U 5/5 | MAJOR ISSUE | Not reliable enough as a standalone handoff; raw conversation review is likely needed. The original session is too short for a rich Goal Stack. The representation is very short. |
| `conv_056_5b11b69768a1` | 2 | G 5/5 / C 5/5 / B 5/5 / E 5/5 / U 5/5 | MAJOR ISSUE | Not reliable enough as a standalone handoff; raw conversation review is likely needed. The original session is too short for a rich Goal Stack. Blocker is marked as Hard Blocker; verify whether it truly blocks continuation. Goal Stack is empty or nearly empty. The representation is very short. |
| `conv_087_6cc20385911d` | 2 | G 5/5 / C 5/5 / B 5/5 / E 5/5 / U 5/5 | MAJOR ISSUE | Not reliable enough as a standalone handoff; raw conversation review is likely needed. The original session is too short for a rich Goal Stack. The representation is very short. |
| `conv_092_fce913ef6ee5` | 2 | G 5/5 / C 5/5 / B 5/5 / E 5/5 / U 5/5 | MAJOR ISSUE | Not reliable enough as a standalone handoff; raw conversation review is likely needed. The original session is too short for a rich Goal Stack. |
| `conv_095_21e3b4dac980` | 2 | G 5/5 / C 5/5 / B 5/5 / E 5/5 / U 5/5 | MAJOR ISSUE | Not reliable enough as a standalone handoff; raw conversation review is likely needed. The original session is too short for a rich Goal Stack. The representation is very short. |
| `conv_099_0093f6ad4e80` | 2 | G 5/5 / C 5/5 / B 5/5 / E 5/5 / U 5/5 | MAJOR ISSUE | Not reliable enough as a standalone handoff; raw conversation review is likely needed. The original session is too short for a rich Goal Stack. The representation is very short. |
| `conv_103_2b7885a3987f` | 2 | G 5/5 / C 5/5 / B 5/5 / E 5/5 / U 5/5 | MAJOR ISSUE | Not reliable enough as a standalone handoff; raw conversation review is likely needed. The original session is too short for a rich Goal Stack. |
| `conv_004_17c992ac2511` | 2 | G 5/5 / C 5/5 / B 5/5 / E 5/5 / U 5/5 | MINOR ISSUE | Usable with caution; the session is understandable but one field needs reviewer attention. The original session is too short for a rich Goal Stack. The representation is very short. |
| `conv_022_7d0a4eaf17bc` | 2 | G 5/5 / C 5/5 / B 5/5 / E 5/5 / U 5/5 | MINOR ISSUE | Usable with caution; the session is understandable but one field needs reviewer attention. The original session is too short for a rich Goal Stack. The representation is very short. |
| `conv_024_59efc4010713` | 2 | G 5/5 / C 5/5 / B 5/5 / E 5/5 / U 5/5 | MINOR ISSUE | Usable with caution; the session is understandable but one field needs reviewer attention. The original session is too short for a rich Goal Stack. The representation is very short. |
| `conv_026_a434dc71f68f` | 2 | G 5/5 / C 5/5 / B 5/5 / E 5/5 / U 5/5 | MINOR ISSUE | Usable with caution; the session is understandable but one field needs reviewer attention. The original session is too short for a rich Goal Stack. The representation is very short. |
| `conv_029_70fa3df1deb9` | 2 | G 5/5 / C 5/5 / B 5/5 / E 5/5 / U 5/5 | MINOR ISSUE | Usable with caution; the session is understandable but one field needs reviewer attention. The original session is too short for a rich Goal Stack. The representation is very short. |
| `conv_035_af1ca69b2ad3` | 2 | G 5/5 / C 5/5 / B 5/5 / E 5/5 / U 5/5 | MINOR ISSUE | Usable with caution; the session is understandable but one field needs reviewer attention. The original session is too short for a rich Goal Stack. |
| `conv_038_70e3bffa8a73` | 2 | G 5/5 / C 5/5 / B 5/5 / E 5/5 / U 5/5 | MINOR ISSUE | Usable with caution; the session is understandable but one field needs reviewer attention. The original session is too short for a rich Goal Stack. The representation is very short. |
| `conv_041_a4290fe1475b` | 2 | G 5/5 / C 5/5 / B 5/5 / E 5/5 / U 5/5 | MINOR ISSUE | Usable with caution; the session is understandable but one field needs reviewer attention. The original session is too short for a rich Goal Stack. The representation is very short. |

## Repeated Issues Found

- **Very short conversations do not support rich Goal Stack extraction.** Many MAJOR ISSUE samples have only 1?2 records.
- **Active Goal can be empty or weak in short sessions.** This is often acceptable, but the Review Book should mark these as low-context cases.
- **Blocker is conservative.** Only a small number of samples have `present` blocker. Several long sessions have `none_observed`, which may be correct, but should be checked for missed soft blockers.
- **Blocker lacks type distinction.** Hard blockers, decision blockers, strategy blockers, and understanding blockers are mixed into one field.
- **Some Korean source content appears garbled.** This reduces user trust and usability even when the structural fields are present.
- **Current Situation is consistently present.** This is a strong positive signal, but reviewers should still check whether it is specific rather than generic.
- **Evidence volume is generally reasonable.** I did not see evidence overload as a systemic issue in this 124-sample batch.

## Schema Changes Worth Considering

These are schema-level observations, not prompt edits:

1. **Add `blocker.type`.** Suggested values: `hard`, `decision`, `strategy`, `understanding`, `none`, `unknown`.
2. **Add `confidence` per major field.** Short conversations should be allowed to say ?low confidence? rather than forcing a full representation.
3. **Add `session_size_class`.** Examples: `one_turn`, `short`, `medium`, `long`. This would prevent short sessions from being judged like long handoff sessions.
4. **Separate `resume_state` from `summary`.** Current Situation is useful, but a dedicated ?what should the next person do first?? field may improve handoff usability.
5. **Add `language_quality` or `readability_warning`.** Garbled text or mixed-language output should be detectable without manual inspection.

## Prompt Changes Worth Considering

These seem solvable by prompt guidance rather than schema redesign:

1. In very short sessions, explicitly allow minimal Goal Stack instead of over-structuring.
2. Ask the model to distinguish ?no blocker observed? from ?possible soft blocker?.
3. Ask for user-centered goals rather than assistant-action-centered goals.
4. Ask Current Situation to avoid generic wording and include the latest concrete checkpoint.
5. Ask for concise evidence selection when many events are available.

## Most Impressive Representation

`conv_118_e5c1c732b9ae` stood out because it is the longest session in the set and still produced a coherent representation. The Goal Stack is rich, a blocker is identified, evidence count remains manageable, and the output appears usable as a real handoff artifact.

This is the strongest signal that the project has value as a Session Representation Engine: a very long conversation can be compressed into a structured state that a human can inspect quickly.

## Most Disappointing Representation

`conv_012_f46fd698b266` and `conv_100_d85906367670` were the weakest. Both are extremely short, have empty or near-empty Goal Stack, and do not provide enough context for confident handoff.

This is not necessarily a model failure. It shows that the representation schema has limited value for very short conversations unless the output explicitly marks the session as too small for meaningful state extraction.

## Final Conclusion

### 1. Can a person resume a session from the Representation alone?

For many medium and long sessions, yes. For very short sessions, no: the representation can describe the exchange, but it cannot provide meaningful handoff context.

### 2. Is Goal Stack actually useful?

Yes. Goal Stack is useful when the conversation has multiple stages, decisions, or evolving objectives. It is less useful for one-turn or two-turn conversations.

### 3. Is Current Situation sufficiently explanatory?

Mostly yes. It is the most consistently available field and often gives the fastest path to understanding the checkpoint state.

### 4. Should the Blocker definition be revised?

Yes. Blocker needs clearer typing. The current binary-ish `present` / `none_observed` / `unknown` structure is not expressive enough for hard blockers versus decision, strategy, or understanding blockers.

### 5. Does this project show enough potential as a Session Representation Engine?

Yes. The 124-sample batch shows that the engine can generate broadly usable representations from real ChatGPT export data. The next step should be targeted Human Evaluation, especially around blocker correctness, short-session handling, and handoff usefulness.

## Appendix: Per-Representation Review Matrix

Legend: G = Goal Stack, C = Current Situation, B = Blocker, E = Evidence, U = Human Usability.

| No | Sample | Records | G | C | B | Blocker type | E | U | Overall | Reviewer Comment |
| ---: | --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `conv_000_d4223b7b84d6` | 125 | 5/5 | 5/5 | 5/5 | Hard Blocker | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. Long-session behavior should be checked, especially whether the active goal and blocker are complete. Blocker is marked as Hard Blocker; verify whether it truly blocks continuation. |
| 2 | `conv_001_3c10e5969ea5` | 10 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| 3 | `conv_002_17e9735ba932` | 2 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | MAJOR ISSUE | Not reliable enough as a standalone handoff; raw conversation review is likely needed. The original session is too short for a rich Goal Stack. The representation is very short. |
| 4 | `conv_003_0c706231e78c` | 4 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. The representation is very short. |
| 5 | `conv_004_17c992ac2511` | 2 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | MINOR ISSUE | Usable with caution; the session is understandable but one field needs reviewer attention. The original session is too short for a rich Goal Stack. The representation is very short. |
| 6 | `conv_005_fa7e362ee49b` | 42 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| 7 | `conv_006_5f0158d94934` | 1 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | MINOR ISSUE | Usable with caution; the session is understandable but one field needs reviewer attention. The original session is too short for a rich Goal Stack. The representation is very short. |
| 8 | `conv_007_89cce919088a` | 14 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| 9 | `conv_008_fdfeb24b9fb4` | 8 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| 10 | `conv_009_72875ce90a7c` | 10 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| 11 | `conv_010_bf56a03aafbd` | 6 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. The representation is very short. |
| 12 | `conv_011_da85e38812fd` | 20 | 5/5 | 5/5 | 5/5 | Decision/Strategy Blocker | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. Blocker is marked as Decision/Strategy Blocker; verify whether it truly blocks continuation. |
| 13 | `conv_012_f46fd698b266` | 2 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | MAJOR ISSUE | Not reliable enough as a standalone handoff; raw conversation review is likely needed. The original session is too short for a rich Goal Stack. Goal Stack is empty or nearly empty. The representation is very short. |
| 14 | `conv_013_82cf5e093db7` | 14 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| 15 | `conv_014_d3ad41a5656b` | 4 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. The representation is very short. |
| 16 | `conv_015_5005d61b3fdc` | 6 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| 17 | `conv_016_037a77078a29` | 46 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| 18 | `conv_017_d770cba7f274` | 25 | 5/5 | 5/5 | 5/5 | Decision/Strategy Blocker | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. Blocker is marked as Decision/Strategy Blocker; verify whether it truly blocks continuation. |
| 19 | `conv_018_b144026097ce` | 4 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. The representation is very short. |
| 20 | `conv_019_234027074c66` | 26 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| 21 | `conv_020_2e5397c85d40` | 15 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| 22 | `conv_021_88947b1ad509` | 4 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. The representation is very short. |
| 23 | `conv_022_7d0a4eaf17bc` | 2 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | MINOR ISSUE | Usable with caution; the session is understandable but one field needs reviewer attention. The original session is too short for a rich Goal Stack. The representation is very short. |
| 24 | `conv_023_259a55ac1ebc` | 4 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| 25 | `conv_024_59efc4010713` | 2 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | MINOR ISSUE | Usable with caution; the session is understandable but one field needs reviewer attention. The original session is too short for a rich Goal Stack. The representation is very short. |
| 26 | `conv_025_755724669b74` | 4 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. The representation is very short. |
| 27 | `conv_026_a434dc71f68f` | 2 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | MINOR ISSUE | Usable with caution; the session is understandable but one field needs reviewer attention. The original session is too short for a rich Goal Stack. The representation is very short. |
| 28 | `conv_027_43b38a5632ec` | 6 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| 29 | `conv_028_43e91089f28e` | 8 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| 30 | `conv_029_70fa3df1deb9` | 2 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | MINOR ISSUE | Usable with caution; the session is understandable but one field needs reviewer attention. The original session is too short for a rich Goal Stack. The representation is very short. |
| 31 | `conv_030_077f080f145f` | 6 | 5/5 | 5/5 | 5/5 | Decision/Strategy Blocker | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. Blocker is marked as Decision/Strategy Blocker; verify whether it truly blocks continuation. The representation is very short. |
| 32 | `conv_031_d15fbb45988c` | 22 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| 33 | `conv_032_a82516fd633a` | 18 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| 34 | `conv_033_28fbdb9fc3f9` | 8 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| 35 | `conv_034_3487abebc317` | 8 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| 36 | `conv_035_af1ca69b2ad3` | 2 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | MINOR ISSUE | Usable with caution; the session is understandable but one field needs reviewer attention. The original session is too short for a rich Goal Stack. |
| 37 | `conv_036_4fc9600c490e` | 4 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. The representation is very short. |
| 38 | `conv_037_8e164283c686` | 4 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| 39 | `conv_038_70e3bffa8a73` | 2 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | MINOR ISSUE | Usable with caution; the session is understandable but one field needs reviewer attention. The original session is too short for a rich Goal Stack. The representation is very short. |
| 40 | `conv_039_969b7c59cf3c` | 14 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| 41 | `conv_040_0b8d3b5361f2` | 2 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | MAJOR ISSUE | Not reliable enough as a standalone handoff; raw conversation review is likely needed. The original session is too short for a rich Goal Stack. The representation is very short. |
| 42 | `conv_041_a4290fe1475b` | 2 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | MINOR ISSUE | Usable with caution; the session is understandable but one field needs reviewer attention. The original session is too short for a rich Goal Stack. The representation is very short. |
| 43 | `conv_042_69d0f3755de4` | 6 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| 44 | `conv_043_0b1ec4ee87c9` | 10 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| 45 | `conv_044_a9cce93889e3` | 4 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. The representation is very short. |
| 46 | `conv_045_211a11ef4e3e` | 2 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | MINOR ISSUE | Usable with caution; the session is understandable but one field needs reviewer attention. The original session is too short for a rich Goal Stack. The representation is very short. |
| 47 | `conv_046_c5c22bbe6a56` | 2 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | MINOR ISSUE | Usable with caution; the session is understandable but one field needs reviewer attention. The original session is too short for a rich Goal Stack. The representation is very short. |
| 48 | `conv_047_6f999d628b91` | 2 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | MINOR ISSUE | Usable with caution; the session is understandable but one field needs reviewer attention. The original session is too short for a rich Goal Stack. The representation is very short. |
| 49 | `conv_048_87b9519c6518` | 2 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | MINOR ISSUE | Usable with caution; the session is understandable but one field needs reviewer attention. The original session is too short for a rich Goal Stack. The representation is very short. |
| 50 | `conv_049_82ea1be4b421` | 2 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | MINOR ISSUE | Usable with caution; the session is understandable but one field needs reviewer attention. The original session is too short for a rich Goal Stack. The representation is very short. |
| 51 | `conv_050_2a7098c342f5` | 2 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | MINOR ISSUE | Usable with caution; the session is understandable but one field needs reviewer attention. The original session is too short for a rich Goal Stack. The representation is very short. |
| 52 | `conv_051_df1d918713fb` | 2 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | MAJOR ISSUE | Not reliable enough as a standalone handoff; raw conversation review is likely needed. The original session is too short for a rich Goal Stack. The representation is very short. |
| 53 | `conv_052_142e18461520` | 2 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | MINOR ISSUE | Usable with caution; the session is understandable but one field needs reviewer attention. The original session is too short for a rich Goal Stack. The representation is very short. |
| 54 | `conv_053_baacdb11f120` | 2 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | MINOR ISSUE | Usable with caution; the session is understandable but one field needs reviewer attention. The original session is too short for a rich Goal Stack. The representation is very short. |
| 55 | `conv_054_3015ce9999e6` | 2 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | MAJOR ISSUE | Not reliable enough as a standalone handoff; raw conversation review is likely needed. The original session is too short for a rich Goal Stack. The representation is very short. |
| 56 | `conv_055_1d8de690432c` | 2 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | MINOR ISSUE | Usable with caution; the session is understandable but one field needs reviewer attention. The original session is too short for a rich Goal Stack. The representation is very short. |
| 57 | `conv_056_5b11b69768a1` | 2 | 5/5 | 5/5 | 5/5 | Hard Blocker | 5/5 | 5/5 | MAJOR ISSUE | Not reliable enough as a standalone handoff; raw conversation review is likely needed. The original session is too short for a rich Goal Stack. Blocker is marked as Hard Blocker; verify whether it truly blocks continuation. Goal Stack is empty or nearly empty. The representation is very short. |
| 58 | `conv_057_02535a0f4ea9` | 2 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | MINOR ISSUE | Usable with caution; the session is understandable but one field needs reviewer attention. The original session is too short for a rich Goal Stack. The representation is very short. |
| 59 | `conv_058_93f26cbfffc6` | 2 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | MINOR ISSUE | Usable with caution; the session is understandable but one field needs reviewer attention. The original session is too short for a rich Goal Stack. The representation is very short. |
| 60 | `conv_059_ffe0dc2b2c03` | 4 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| 61 | `conv_060_8fc881f559a9` | 6 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| 62 | `conv_061_c2c64dcae22b` | 15 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| 63 | `conv_062_8fb10ce07e40` | 2 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | MINOR ISSUE | Usable with caution; the session is understandable but one field needs reviewer attention. The original session is too short for a rich Goal Stack. The representation is very short. |
| 64 | `conv_063_4a61e6155ce2` | 48 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| 65 | `conv_064_43bdc81473b6` | 213 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. Long-session behavior should be checked, especially whether the active goal and blocker are complete. No blocker is reported despite a long session; verify this is not a missed soft blocker. |
| 66 | `conv_065_6d8478ce5e7e` | 4 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| 67 | `conv_066_90c1b91de722` | 6 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| 68 | `conv_067_7938b22514d5` | 26 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| 69 | `conv_068_70b85163591c` | 30 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| 70 | `conv_069_2ea5b60acfc9` | 4 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. The representation is very short. |
| 71 | `conv_070_06df0979c014` | 6 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| 72 | `conv_071_d6342b341f57` | 2 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | MINOR ISSUE | Usable with caution; the session is understandable but one field needs reviewer attention. The original session is too short for a rich Goal Stack. The representation is very short. |
| 73 | `conv_072_39645adff1e8` | 4 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| 74 | `conv_073_28621bc71277` | 2 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | MINOR ISSUE | Usable with caution; the session is understandable but one field needs reviewer attention. The original session is too short for a rich Goal Stack. The representation is very short. |
| 75 | `conv_074_21fbeff80316` | 6 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| 76 | `conv_075_64e7cc9937ae` | 12 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| 77 | `conv_076_e283946d529f` | 42 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| 78 | `conv_077_6a1cdc6a1499` | 2 | 5/5 | 5/5 | 5/5 | Decision/Strategy Blocker | 5/5 | 5/5 | MINOR ISSUE | Usable with caution; the session is understandable but one field needs reviewer attention. The original session is too short for a rich Goal Stack. Blocker is marked as Decision/Strategy Blocker; verify whether it truly blocks continuation. The representation is very short. |
| 79 | `conv_078_d6ee78430bfd` | 26 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. The representation is very short. |
| 80 | `conv_079_64cd60c92bfd` | 2 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | MINOR ISSUE | Usable with caution; the session is understandable but one field needs reviewer attention. The original session is too short for a rich Goal Stack. The representation is very short. |
| 81 | `conv_080_d13600da776d` | 12 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| 82 | `conv_081_14f309cefba7` | 1 | 5/5 | 5/5 | 5/5 | Decision/Strategy Blocker | 5/5 | 5/5 | MINOR ISSUE | Usable with caution; the session is understandable but one field needs reviewer attention. The original session is too short for a rich Goal Stack. Blocker is marked as Decision/Strategy Blocker; verify whether it truly blocks continuation. The representation is very short. |
| 83 | `conv_082_8843724117bd` | 6 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| 84 | `conv_083_cc33c4e0c73f` | 4 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. The representation is very short. |
| 85 | `conv_084_7d3c01eb3d62` | 22 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| 86 | `conv_085_1da27bb426bb` | 2 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | MINOR ISSUE | Usable with caution; the session is understandable but one field needs reviewer attention. The original session is too short for a rich Goal Stack. The representation is very short. |
| 87 | `conv_086_6f900fef9f50` | 2 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | MINOR ISSUE | Usable with caution; the session is understandable but one field needs reviewer attention. The original session is too short for a rich Goal Stack. The representation is very short. |
| 88 | `conv_087_6cc20385911d` | 2 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | MAJOR ISSUE | Not reliable enough as a standalone handoff; raw conversation review is likely needed. The original session is too short for a rich Goal Stack. The representation is very short. |
| 89 | `conv_088_e905342699c3` | 6 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| 90 | `conv_089_b8ea5003c8aa` | 4 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| 91 | `conv_090_b16ead817e36` | 22 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| 92 | `conv_091_7e47edf3854c` | 2 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | MINOR ISSUE | Usable with caution; the session is understandable but one field needs reviewer attention. The original session is too short for a rich Goal Stack. The representation is very short. |
| 93 | `conv_092_fce913ef6ee5` | 2 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | MAJOR ISSUE | Not reliable enough as a standalone handoff; raw conversation review is likely needed. The original session is too short for a rich Goal Stack. |
| 94 | `conv_093_8b2fb1c3121a` | 2 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | MINOR ISSUE | Usable with caution; the session is understandable but one field needs reviewer attention. The original session is too short for a rich Goal Stack. |
| 95 | `conv_094_a6a1b3419bec` | 66 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. Long-session behavior should be checked, especially whether the active goal and blocker are complete. No blocker is reported despite a long session; verify this is not a missed soft blocker. |
| 96 | `conv_095_21e3b4dac980` | 2 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | MAJOR ISSUE | Not reliable enough as a standalone handoff; raw conversation review is likely needed. The original session is too short for a rich Goal Stack. The representation is very short. |
| 97 | `conv_096_a1faaa15653f` | 14 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| 98 | `conv_097_bdafc15183c1` | 6 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| 99 | `conv_098_ccb7d0095f2d` | 4 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. The representation is very short. |
| 100 | `conv_099_0093f6ad4e80` | 2 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | MAJOR ISSUE | Not reliable enough as a standalone handoff; raw conversation review is likely needed. The original session is too short for a rich Goal Stack. The representation is very short. |
| 101 | `conv_100_d85906367670` | 2 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | MAJOR ISSUE | Not reliable enough as a standalone handoff; raw conversation review is likely needed. The original session is too short for a rich Goal Stack. Goal Stack is empty or nearly empty. The representation is very short. |
| 102 | `conv_101_a15119200759` | 4 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. The representation is very short. |
| 103 | `conv_102_88bb2c07cceb` | 90 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. Long-session behavior should be checked, especially whether the active goal and blocker are complete. No blocker is reported despite a long session; verify this is not a missed soft blocker. |
| 104 | `conv_103_2b7885a3987f` | 2 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | MAJOR ISSUE | Not reliable enough as a standalone handoff; raw conversation review is likely needed. The original session is too short for a rich Goal Stack. |
| 105 | `conv_104_f66a3800b934` | 4 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. The representation is very short. |
| 106 | `conv_105_64f41c5c9c4b` | 58 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. Long-session behavior should be checked, especially whether the active goal and blocker are complete. No blocker is reported despite a long session; verify this is not a missed soft blocker. |
| 107 | `conv_106_c11190b3ccf8` | 36 | 5/5 | 5/5 | 5/5 | Decision/Strategy Blocker | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. Blocker is marked as Decision/Strategy Blocker; verify whether it truly blocks continuation. |
| 108 | `conv_107_d652a748e499` | 66 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. Long-session behavior should be checked, especially whether the active goal and blocker are complete. No blocker is reported despite a long session; verify this is not a missed soft blocker. |
| 109 | `conv_108_08173692a25c` | 36 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| 110 | `conv_109_52666294240e` | 254 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. Long-session behavior should be checked, especially whether the active goal and blocker are complete. No blocker is reported despite a long session; verify this is not a missed soft blocker. |
| 111 | `conv_110_39cf671db12a` | 4 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| 112 | `conv_111_0acab6219b59` | 6 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| 113 | `conv_112_1cdf5aaacc01` | 39 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| 114 | `conv_113_3ccb60f22e8a` | 2 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | MINOR ISSUE | Usable with caution; the session is understandable but one field needs reviewer attention. The original session is too short for a rich Goal Stack. The representation is very short. |
| 115 | `conv_114_920b0aceb9a5` | 40 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| 116 | `conv_115_a8013b481176` | 4 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| 117 | `conv_116_3a2b65cf93f4` | 12 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| 118 | `conv_117_307c2404ef2b` | 21 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| 119 | `conv_118_e5c1c732b9ae` | 464 | 5/5 | 5/5 | 5/5 | Decision/Strategy Blocker | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. Long-session behavior should be checked, especially whether the active goal and blocker are complete. Blocker is marked as Decision/Strategy Blocker; verify whether it truly blocks continuation. |
| 120 | `conv_119_05166bd6ff6a` | 8 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| 121 | `conv_120_084de5a85777` | 54 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. Long-session behavior should be checked, especially whether the active goal and blocker are complete. No blocker is reported despite a long session; verify this is not a missed soft blocker. |
| 122 | `conv_121_bd00971cba08` | 20 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| 123 | `conv_122_1eb26bd2d847` | 21 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
| 124 | `conv_123_c2c3aa41b8df` | 23 | 5/5 | 5/5 | 5/5 | None observed | 5/5 | 5/5 | PASS | The representation is usable at review speed; the goal/current state structure is coherent. |
