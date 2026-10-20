# Git Question Bank Audit — 2026-10-04

**Status: draft for manual review — nothing seeded, no DB writes made, no status changes applied.**

## Methodology

All 586 questions in the `git` subject (576 Trivia + 10 General, across 19 topics) were read in full by six parallel review passes, each given the exact Question Quality Policy text and instructed to flag violations, find duplicates, investigate structural oddities, and draft new questions only where a concept is genuinely missing. This mirrors the methodology used for the CSS/HTML/JavaScript audits this week.

**Headline fact that shapes this whole document:** unlike CSS, HTML, and JavaScript's General bank, **the Git subject has zero Active questions anywhere — literally everything is sitting at `status='Pending'`.** Nothing in this subject has ever been reviewed. This audit therefore combines two things that were separate phases for other subjects: a correctness/quality review of existing content (like the JS Trivia review), and a concept-gap/new-question analysis (like the CSS/HTML audits) — all on content that has never been through either process before.

**CodeMerit Question Quality Policy** (applied verbatim): no length-tell; plausible distractors; the correct option's `comment` teaches the "why"; natural difficulty leveling; no duplicates; General `answer` must be real HTML (not flat text), literal `<`/`>`/`&` meant as text entity-escaped, neutral voice, acronyms spelled out, genuinely informative.

## Executive Summary

| Metric | Value |
|---|---|
| Questions audited | 586 (576 Trivia + 10 General), 19 topics |
| Active questions before this audit | **0** |
| Topics with zero questions at all | 2 (confirmed one is a live production bug) |
| Topics that are duplicate/overlap artifacts of another topic | 2 confirmed, 1 more flagged for reconciliation |
| Hard correctness bugs found | 5 (2 wrong-answer mismarks, 2 data-corruption, 1 factually-wrong-as-written) |
| Trivia questions missing a "why" comment on the correct option | **533 of 576 (93%)** |
| General questions needing HTML reformatting | **10 of 10 (100%)** |
| Duplicate clusters found (within + across topics) | ~20 |
| New questions drafted for genuine concept gaps | 27 |

**Bottom line:** the actual Git knowledge encoded in this bank is good — across all 586 questions, reviewers found only 5 hard correctness bugs, a genuinely low rate for never-reviewed content, including on the specific traps that usually trip up AI-generated Git content (rebase's flipped ours/theirs, merge `--abort` vs `--quit`, fetch vs pull, force vs force-with-lease). The real problems are structural and procedural: a live bug in the published curriculum, two topics that duplicate older ones under a confusingly similar name, and a near-total absence of the "why" explanation that's supposed to accompany every correct answer.

## Critical Structural Findings

These are unique to this audit — Git's topic table has accumulated two overlapping curriculum passes, and the seams show.

### 1. Live production bug: `branching-merging` (topic 363) is an empty topic sitting in the published curriculum

Confirmed directly: topic 363 has **zero** questions, **zero** lessons, and zero `quiz_topic` rows. But it is **not dead data** — it's linked via `subject_track_topic` (row 375) into **`subject_track` id 25, "Git Foundations," which has `isPublished = 1`**. Pulling that published track's full topic sequence shows topic 363 sitting at the same position/tier as the fully-populated `branching-and-merging` (topic 21, 58 questions):

```
...
265 -> branching-and-merging   (topic 21 — 58 Trivia + 1 General, populated)
266 -> resolving-merge-conflicts (topic 22 — 46 Trivia + 1 General, populated)
...
375 -> branching-merging        (topic 363 — EMPTY)
376 -> remote-collaboration     (topic 364 — EMPTY, see below)
```

A real learner progressing through the published "Git Foundations" track right now will hit a curriculum entry with no content behind it. This looks like a half-finished slug rename (`branching-and-merging` → `branching-merging`) that got wired into `subject_track_topic` but never had `question_topic`/lesson links migrated, while the old topic kept everything. **This needs a decision, not just a content fix**: either delete the topic-363 track entry, or migrate topic 21's content onto 363 and retire 21 — but confirm first whether anything (frontend routing, hardcoded slugs) depends on either slug before acting.

### 2. `remote-collaboration` (topic 364) is empty but is a real, intentional topic with a lesson already written

Also zero questions — but unlike topic 363, this one has a real lesson: id 89, "Remote Collaboration in Practice" (PR workflow, review, branch protection), and it's wired into a subject track. **This is a genuine content gap** (a lesson exists with nothing to quiz it), not cleanup — whoever authors Git content next should prioritize writing questions for this topic specifically, covering PR workflow, code review practices, and branch protection (content that's conceptually distinct from topic 23's raw CLI remote mechanics).

### 3. `git-fundamentals` (topic 214) is a thinner, same-difficulty duplicate of `introducing-git-and-version-control` (topic 17)

18 questions vs. topic 17's 40, both almost entirely Level 1, with 5+ confirmed near-duplicate pairs (what-is-VCS, .git-folder contents, staging-area concept, `git status` output, "untracked" file meaning). Not 100% redundant — it owns some unique ground (`git diff --staged`, `.gitignore` basics, `git commit --amend`, `HEAD`) — but reads like a parallel re-authoring pass of the same beginner material rather than a deliberate "next tier." **Recommendation:** treat topic 17 as canonical, migrate 214's unique questions into it, retire the duplicate half.

### 4. `tags-releases-history` (topic 218) is a confirmed duplicate-pass artifact of `tagging-and-releases` (topic 27)

8 of 218's 10 Trivia questions test mechanics topic 27 already tests, often near-identically (pushing tags, lightweight vs. annotated, deleting tags, `git describe`, checkout-tag-detached-HEAD, pattern listing). **Concrete evidence beyond topic/title similarity:** topic 218 is labeled "Advanced" but has zero Level-3 questions, while topic 27 — labeled the more modest "Foundation" — has three genuinely harder Level-3 questions. The "Advanced" label doesn't match the actual content; this looks exactly like the thinner, later curriculum-reorganization pass seen elsewhere (JavaScript's 3 added topics is the closest parallel this week). The other 2 questions in 218 (`git diff`, `git blame`) aren't about tags at all — miscategorized. **Recommendation:** consolidate 218 into 27, retire the 8 duplicates, relocate the 2 miscategorized questions.

### 5. `merge-conflicts-resolution` (topic 365) has a confusingly similar name to `resolving-merge-conflicts` (topic 22) but is NOT a duplicate

Only 6 questions, but each is genuinely advanced/niche (`git merge-file`, custom merge drivers via `.gitattributes`, `-X ignore-space-change`, `-s ours` strategy, worktree conflict isolation, `git log --cherry-pick --left-right`) — none of which overlap topic 22's core conflict-resolution-workflow content. **Recommendation: rename, don't merge** — e.g. to `advanced-merge-techniques` — to remove the naming confusion while keeping the content.

### 6. `git-workflows-best-practices` (topic 219) is legitimate, distinct content — just mislabeled

Covers Git Flow, GitHub Flow, trunk-based development, Conventional Commits, atomic commits, branch protection, rebase-before-PR rationale — none of which duplicates anything else in the bank. Labeled "Advanced," but every question is Level 1-2. **Recommendation:** keep as its own topic, just relabel or accept that its content is intermediate, not advanced.

## Critical Data Bugs (content-level, not structural)

1. **Q698 (basics-of-git-repositories)** — "What happens if you run `git init` inside an existing Git repository?" has the **wrong option marked correct**. Marked-correct says "creates a nested repository" (wrong for this exact scenario — that only happens initializing a *subdirectory*). The actually-correct option ("reinitializes the .git folder") sits right there marked false. **Fix: flip the `correct` flag.**

2. **Q808 (ignoring-and-undoing-changes)** — "Which section of .gitignore can use wildcard patterns like .log?" — the question is broken as stored: `.gitignore` has no "sections," and the example pattern `.log` is missing its leading `*` (almost certainly a lost character from `*.log`), so none of the 4 options meaningfully answer the broken premise. **Recommend rewriting from scratch.**

3. **Q770 (resolving-merge-conflicts)** — the `answer` field has literal data corruption: a string of 32 zero characters (`000000000000000000000000000000`) appended after the real explanation. **Fix: strip the garbage suffix.**

4. **Q3293 (resolving-merge-conflicts)** — asks about `git rebase --continue` but the `answer` field contains **completely unrelated text copy-pasted from Q770** (about merge `--ours` strategy). A learner who answers correctly is shown an explanation about something else entirely. **Fix: write a real explanation for this question.**

5. **Q865 (tagging-and-releases)** — "Why are annotated tags preferred for public releases?" — correct option says *"They include more metadata and are signed."* This is **factually wrong**: annotated tags are not signed by default; signing requires the separate `-s` flag, which the very next question (Q866) correctly tests. This conflates two different things. **Fix: reword to remove the "signed" claim** (or make signing conditional — "and can optionally be GPG-signed").

**Also found, lower severity:**
- **Q866** — the example command `git tag -s v1.0 -m Signed release` has an unquoted multi-word message — broken as literal shell syntax. Needs quotes around the message.
- **Q694** — correct option omits a required flag (`git config --show-origin` alone errors in real Git; needs `--list` or `--get`/`--get-regexp` combined with it).
- **Q695** — overgeneralizes "Git cancels the commit if identity isn't set" as an absolute rule; it's environment-dependent (Git can often auto-detect a usable identity).
- **Q823** — invents non-standard terminology ("fast-forward rebase" isn't a real Git term).
- **Q845** — describes `git stash branch` incompletely (undersells that it also checks out the new branch and applies+drops the stash).
- **Q879** — a stray `"D."` list-marker artifact leaked into an option's text.

## Systemic Violations (affect most of the bank)

### 1. Missing "why" comments on the correct option — 533 of 576 Trivia questions (93%)

This is the single largest, most consistent finding across every one of the 6 review clusters, confirmed independently each time:

| Topic cluster | Missing comments |
|---|---|
| introducing-git-and-version-control / git-fundamentals / installing-git | 84 / 90 (93%) |
| basics-of-git-repositories / basic-git-commands / ignoring-and-undoing-changes | 122 / 122 (100%) |
| branching-and-merging / resolving-merge-conflicts | 95 / 104 (91%) |
| working-with-remote-repositories / merge-conflicts-resolution | 57 / 60 (95%) |
| rebasing / stashing-work / tagging-and-releases | 114 / 120 (95%) |
| git-hooks-and-automation / advanced-troubleshooting / tags-releases-history / git-workflows | 61 / 81 (75%) |

Where comments do exist, they're generally well-written — they cluster around a specific small batch of question IDs (2200s–2270s range), suggesting one authoring pass included comments and every other pass (the older legacy batch and the larger 5000-series batch) simply never got them.

### 2. All 10 General questions need HTML reformatting

Every single General question in the entire `git` subject has a flat plain-text `answer` field with zero HTML markup — the same bug class already found and fixed in the JavaScript and DevOps General banks this week. Content/accuracy is consistently good; this is a pure formatting fix (wrap in `<p>`, command references in `<code>`).

### 3. Answer-revealing hints concentrated in the oldest content batches

Dozens of hints across the bank don't nudge — they restate or directly name the answer (e.g. "Think of the word rename" for a question whose answer is `git remote rename`; "The -u flag stands for untracked" directly naming the flag that IS the answer; "Pop = apply + drop" being the literal answer). This pattern is heavily concentrated in the earliest-seeded question ID ranges (roughly 663–886) — the newer batches (2200s, 5000s) consistently use proper indirect nudges. This is fixable as a targeted pass on specific old IDs rather than a bank-wide rewrite.

## Per-Topic Findings Summary

*(Full correctness/duplicate/gap detail for each topic is preserved in the per-cluster reports this document was compiled from; this section summarizes the disposition.)*

- **introducing-git-and-version-control (17)** — healthy content, needs comment backfill; migrate unique content from 214, retire duplicates.
- **git-fundamentals (214)** — see Structural Finding #3.
- **installing-git-and-basic-configuration (18)** — healthy, 2 bugs (Q694, Q695), needs comment backfill.
- **basics-of-git-repositories (19)** — 1 bug (Q698), 1 within-topic duplicate, needs comment backfill.
- **basic-git-commands (20)** — 2 clarity issues (Q721, Q733 self-contradicts a correct answer elsewhere in the same topic), 2 duplicates, needs comment backfill.
- **ignoring-and-undoing-changes (24)** — 1 bug (Q808), 6 rebase-flavored questions flagged as possibly belonging to a different topic, needs comment backfill.
- **branching-and-merging (21) / resolving-merge-conflicts (22)** — 2 data-corruption bugs, heavy cross-topic duplication (4-way conflict-marker cluster, 3-way `--abort` cluster, 3-way stage+commit cluster), needs comment backfill.
- **branching-merging (363)** — see Structural Finding #1 (live bug).
- **working-with-remote-repositories (23)** — clean content, 1 miscategorized question (Q809), 2 redundant-coverage clusters (upstream flag, fetch-vs-pull), General answer needs HTML, needs comment backfill.
- **merge-conflicts-resolution (365)** — see Structural Finding #5 (rename, don't merge).
- **remote-collaboration (364)** — see Structural Finding #2 (real gap, prioritize authoring).
- **rebasing-and-interactive-rebase (25)** — 1 wording issue (Q823), 1 near-duplicate, needs comment backfill, concentrated revealing-hints in legacy batch.
- **stashing-work (26)** — 1 imprecise answer (Q845), 1 complementary-not-duplicate pair, needs comment backfill.
- **tagging-and-releases (27)** — 2 real bugs (Q865, Q866), needs comment backfill — set to absorb topic 218's unique content if consolidated.
- **git-hooks-and-automation (28)** — clean content (zero correctness errors), 1 stray artifact (Q879), one over-concentrated redundancy cluster (7 questions all testing the same hooks-aren't-version-controlled fact), needs comment backfill.
- **advanced-git-troubleshooting (29)** — clean content, 1 near-duplicate pair, needs comment backfill.
- **tags-releases-history (218)** — see Structural Finding #4 (consolidate into 27).
- **git-workflows-best-practices (219)** — see Structural Finding #6 (keep, relabel).

## Full Catalog of Draft Questions (27 total)

### For introducing-git-and-version-control / git-fundamentals / installing-git cluster

**1. Trivia, Level 1 — what is a remote**
```
Q: What is a Git "remote", and what does origin typically refer to?
Options:
  - [CORRECT] A named link to another copy of the repository that you can push to or pull from
    Comment: git remote -v lists your remotes; "origin" is just the conventional name Git assigns automatically when you clone — not a reserved keyword, and you can rename it or add more.
  - A hidden backup folder that Git creates automatically for safety
  - The branch that always holds production-ready code
  - A setting that controls how often Git saves your work automatically
Hint: Think about the name Git gives the repository you first cloned from, by default.
```

**2. Trivia, Level 2 — fetch vs pull**
```
Q: What is the key difference between git fetch and git pull?
Options:
  - [CORRECT] fetch downloads new remote history without touching your branch; pull does that, then merges it in
    Comment: Because fetch never touches your working files, many developers fetch first to review incoming changes, then merge or pull when ready.
  - fetch downloads changes but pull only previews them without downloading anything
  - They are two different names for the exact same operation
  - pull only works on remote branches; fetch only works on local branches
Hint: One of them also tries to update your current branch for you; the other just looks.
```

**3. Trivia, Level 2 — .gitignore doesn't retroactively untrack**
```
Q: You add a folder to .gitignore, but git status still lists files inside it as modified. Why?
Options:
  - [CORRECT] The files were already tracked by Git before being added to .gitignore, so the rule doesn't apply to them retroactively
    Comment: Untrack them with git rm -r --cached <folder> and commit that change — .gitignore only prevents new files from being tracked, it can't un-track existing ones.
  - .gitignore rules only take effect after a full clone of the repository
  - .gitignore has a syntax error, so none of its rules are being applied
  - Changes inside ignored folders are always shown until the next push
Hint: Think about whether Git was already watching those files before you added the rule.
```

**4. Trivia, Level 1 — SSH vs HTTPS remote URLs**
```
Q: When cloning a repository from GitHub, what's the practical difference between using an HTTPS URL and an SSH URL?
Options:
  - [CORRECT] They clone the same repository; HTTPS authenticates with a password/token, SSH authenticates with a pre-registered key pair
    Comment: SSH avoids re-entering credentials once your public key is added to GitHub, which is why many teams run ssh-keygen before their first clone.
  - SSH clones only the latest commit; HTTPS clones the full history
  - HTTPS is only for private repositories; SSH is only for public ones
  - They are functionally identical, with no difference in authentication
Hint: One of them needs a key pair set up ahead of time; the other just needs a username/token at the moment you connect.
```

### For basics-of-git-repositories / basic-git-commands / ignoring-and-undoing-changes cluster

**5. Trivia, Level 2 — .gitignore negation inside an ignored directory**
```
Q: A directory named logs/ is listed in .gitignore. Inside it you add the line !logs/keep.txt to un-ignore one file. What actually happens?
Options:
  - [CORRECT] Nothing changes — logs/keep.txt stays ignored, because Git never looks inside a directory it has already decided to ignore
    Comment: To make this work, the directory has to be un-ignored too (!logs/), then re-ignore everything inside with logs/*, then !logs/keep.txt.
  - logs/keep.txt is tracked again, exactly as the negation pattern intends
  - The entire logs/ directory becomes un-ignored, not just keep.txt
  - Git throws an error because negation patterns cannot reference subdirectories
Hint: Think about whether Git even looks inside a folder it's already decided to skip.
```

**6. Trivia, Level 1 — git clean's default safety**
```
Q: You run plain git clean with no flags in a repository that has several untracked files. What happens?
Options:
  - [CORRECT] Git refuses to delete anything and tells you to pass -f (or -n) first
    Comment: Git ships with the clean.requireForce safety setting on by default, so a bare git clean does nothing destructive.
  - Git deletes all untracked files immediately, the same as -f
  - Git deletes only untracked files larger than 1 MB
  - Git stages the untracked files instead of deleting them
Hint: Deleting files is risky — Git builds in a safety catch here.
```

**7. Trivia, Level 2 — stash apply vs pop**
```
Q: After running git stash, what's the difference between git stash apply and git stash pop?
Options:
  - [CORRECT] apply re-applies the stashed changes but leaves the stash entry in the list; pop re-applies and then deletes that entry
    Comment: pop is shorthand for apply followed by stash drop. Use apply when you might want to reuse the same stash on another branch.
  - apply deletes the stash entry; pop keeps it for later reuse
  - They're identical — pop is just a shorter alias for apply
  - apply only works on the most recent stash; pop can target any stash in the list
Hint: One of these cleans up after itself; the other leaves the shelf stocked.
```

**8. Trivia, Level 2 — resetting both staged and unstaged layers**
```
Q: A file was staged with git add, then edited again afterward — so it now has one layer of staged changes and a second layer of unstaged changes on top. Which command clears both layers at once, resetting the file fully back to its last-commit content?
Options:
  - [CORRECT] git restore --staged --worktree <file> (or the older equivalent, git checkout HEAD -- <file>)
    Comment: git restore <file> alone only resets the working copy to match the index; git restore --staged alone only unstages. Only targeting both clears both layers back to HEAD.
  - git restore <file>
  - git restore --staged <file>
  - git reset <file>
Hint: The file has two separate layers of change sitting on top of HEAD — make sure you clear both.
```

### For branching-and-merging / resolving-merge-conflicts cluster

**9. Trivia, Level 2 — interactive rebase basics**
```
Q: You want to combine your last 3 commits into one before merging your branch. Which command opens an editor letting you do that?
Options:
  - [CORRECT] git rebase -i HEAD~3
    Comment: -i opens an interactive todo list of the last 3 commits where you can mark any of them squash or fixup to fold them into the one above.
  - git rebase --squash HEAD~3
  - git merge --squash HEAD~3
  - git commit --amend --combine 3
Hint: You need an interactive session over a specific range of recent commits, not a flag on an existing command.
```

**10. Trivia, Level 2 — squash vs fixup**
```
Q: In an interactive rebase's todo list, what's the actual difference between marking a commit squash versus fixup?
Options:
  - [CORRECT] squash folds it into the previous commit and lets you edit the combined commit message; fixup folds it in too but discards this commit's message entirely
    Comment: Use fixup for "oops, forgot a file" commits whose message adds nothing; use squash when you want to merge two commit messages into one.
  - fixup discards the commit's changes, keeping only its message; squash keeps everything
  - squash only works on the very first commit in the list; fixup works anywhere
  - They're identical — fixup is just an older name for squash
Hint: One of them stays quiet about its own commit message; the other wants your input.
```

**11. Trivia, Level 2 — why "three-way merge"**
```
Q: Why is a typical merge between two diverged branches called a "three-way merge"?
Options:
  - [CORRECT] Because Git looks at three points — the two branch tips plus their common ancestor commit — to work out what changed on each side
    Comment: The common ancestor (found by git merge-base) is the baseline Git diffs each tip against.
  - Because exactly three files must differ between the branches for it to count
  - Because it requires three people's approval before completing
  - Because it always produces exactly three new commits
Hint: Count the commits Git has to examine, not files or approvers.
```

**12. Trivia, Level 2 — can't switch branches mid-conflict**
```
Q: You have unresolved conflicts from git merge feature. Without finishing or aborting, you try git checkout main. What happens?
Options:
  - [CORRECT] Git refuses, telling you that you haven't concluded your merge (MERGE_HEAD exists) and to commit or abort first
    Comment: Git tracks the in-progress merge via MERGE_HEAD; until that's cleared by a commit or git merge --abort, it won't let you walk away mid-conflict.
  - Git switches branches and silently discards the conflicted changes
  - Git auto-commits the current conflicted state before switching
  - Git switches you to main in detached HEAD, leaving the conflict unresolved on the side
Hint: Git doesn't let you leave unfinished business half-done.
```

**13. Trivia, Level 2 — ours/theirs flips under rebase (synthesis)**
```
Q: During a plain git merge, git checkout --ours <file> keeps your current branch's version. Does "ours" mean the same thing during a git rebase conflict?
Options:
  - [CORRECT] No — during a rebase, "ours" flips to mean the branch you're rebasing onto, not your original commits
    Comment: Rebase works by checking out the target branch and replaying your commits as patches on top of it, so internally your own commits are treated as the incoming ("theirs") side.
  - Yes — "ours" always means your original branch's commits in both cases
  - No — during a rebase, "ours" means whichever side has more commits
  - It's undefined during a rebase; --ours/--theirs only work in merges
Hint: Think about which branch Git actually has checked out while it's replaying your commits.
```

### For working-with-remote-repositories cluster

**14. Trivia, Level 2 — what clone actually transfers**
```
Q: You clone a repository that has five branches on the remote. Right after cloning, git branch shows only one local branch, but git branch -a shows all five. What actually happened during the clone?
Options:
  - [CORRECT] Git downloaded the full history and refs for every branch, but only checked out the default branch into your working directory
    Comment: A normal clone fetches every branch's history as remote-tracking refs (origin/<branch>); only the default branch gets a local branch and a checked-out working copy.
  - Git only downloaded the default branch's history; the other four are empty placeholder names with no history behind them
  - Git downloaded all five branches' files into the working directory at once and merged them automatically
  - The other four branches exist only on the remote and get fetched one at a time, only when you check each one out
Hint: git branch -a is showing you something that came from the clone itself, not from a later fetch.
```

**15. Trivia, Level 2 — set-upstream-to without pushing**
```
Q: Your local branch reports already exists, and so does origin/reports on the remote (pushed earlier by a teammate). Which command sets origin/reports as reports's upstream, without pushing anything or creating a new branch?
Options:
  - [CORRECT] git branch --set-upstream-to=origin/reports reports
    Comment: This sets the tracking relationship directly in your local config (short form: git branch -u origin/reports) — bookkeeping only, no network operation.
  - git push -u origin reports
  - git remote add reports origin
  - git checkout origin/reports
Hint: There's a dedicated flag just for pointing an existing branch at a tracking ref — no network call needed.
```

**16. Trivia, Level 2 — one-off fetch from a raw URL**
```
Q: A teammate shares the raw URL of their personal fork and says "grab my experiment branch." You don't want to permanently add their fork as a remote. What can you run?
Options:
  - [CORRECT] git fetch https://github.com/teammate/repo.git experiment
    Comment: git fetch <url> <branch> performs a one-off fetch from any reachable URL into FETCH_HEAD, with no named remote required.
  - You have to run git remote add temp <url> first — git fetch only accepts configured remote names
  - git clone https://github.com/teammate/repo.git experiment
  - git pull --from https://github.com/teammate/repo.git experiment
Hint: git fetch accepts something other than a remote name as its source.
```

### For rebasing / stashing-work / tagging-and-releases cluster

**17. Trivia, Level 3 — git rebase --onto**
```
Q: You branched feature off old-base, but old-base has since been replaced by new-base with unrelated history. How do you replay just your feature commits onto new-base, skipping everything from old-base?
Options:
  - [CORRECT] git rebase --onto new-base old-base feature
    Comment: --onto lets you target a different base than the one you're currently sitting on; old-base marks where your branch's own commits begin.
  - git rebase new-base feature
  - git rebase --root new-base
  - git cherry-pick old-base..feature
Hint: Plain git rebase <target> only takes one argument — this needs both where your commits start and where they should land.
```

**18. Trivia, Level 2 — pull --rebase**
```
Q: What does running git pull --rebase do differently from a plain git pull?
Options:
  - [CORRECT] Replays your local commits on top of the fetched upstream changes instead of creating a merge commit
    Comment: git pull is fetch + merge by default; --rebase makes it fetch + rebase instead, keeping history linear.
  - It fetches changes but refuses to integrate them until you rebase manually
  - It force-pushes your local branch to overwrite the remote
  - It squashes all your local commits into one before pulling
Hint: Think about the two different ways pull's integration step can combine incoming changes with yours.
```

**19. Trivia, Level 2 — rebase vs merge as a team judgment call**
```
Q: Your team has several junior developers, and multiple people often push to the same long-lived feature branch. Which approach to keeping that branch in sync with main is generally safer?
Options:
  - [CORRECT] Merge main into the feature branch — it doesn't rewrite commits other people already have
    Comment: Rebasing a branch others already pulled rewrites commit hashes they have locally, causing confusing conflicts next time they pull.
  - Rebase the feature branch onto main every time someone pushes
  - It doesn't matter which approach is used
  - Force-push after every rebase so everyone's local copy matches
Hint: Think about who else might already have a local copy of that branch's commits.
```

**20. Trivia, Level 2 — stash --staged**
```
Q: You have both staged and unstaged edits, and want to stash only the staged ones, leaving unstaged edits untouched. Which command (Git 2.35+) does that?
Options:
  - [CORRECT] git stash push --staged
    Comment: --keep-index stashes everything then restores the staged copy afterward — it doesn't change what gets stashed. --staged actually limits the stash itself.
  - git stash push --keep-index
  - git stash -u
  - git add -p && git stash
Hint: Don't confuse this with the flag that just leaves staged changes visible afterward.
```

**21. Trivia, Level 2 — interpreting git describe output**
```
Q: Running git describe outputs v1.2.0-3-ga1b2c3d. What do those three dash-separated pieces correspond to?
Options:
  - [CORRECT] Nearest tag, number of commits since that tag, abbreviated hash of the current commit
    Comment: git describe finds the nearest reachable tag, counts commits since then, and appends g plus the abbreviated HEAD hash.
  - Nearest tag, branch name, author initials
  - Major version, minor version, patch version
  - Tag name, remote name, commit count on the remote
Hint: Each segment answers a different question: which tag, how far past it, and which exact commit.
```

**22. Trivia, Level 3 — risk of moving an already-shared tag**
```
Q: v2.0 was pushed weeks ago and teammates already fetched it. You now run git tag -f v2.0 <new-commit> and force-push the move. What's the main risk for teammates who already have the old v2.0?
Options:
  - [CORRECT] Their local v2.0 still points to the old commit, so their repo and the remote now disagree on what v2.0 means
    Comment: Unlike branches, tags are expected to be fixed — Git doesn't silently re-sync a locally cached tag just because the remote one moved.
  - Git automatically updates everyone's local tag the next time they run any git command
  - Nothing — tags always resolve to whatever the remote currently says, even locally
  - Their clone becomes corrupted and needs to be re-cloned entirely
Hint: Think about what a teammate's local repository still has cached from before you moved the tag.
```

### For git-hooks-and-automation / advanced-git-troubleshooting / git-workflows cluster

**23. Trivia, Level 2 — git merge --abort**
```
Q: You're in the middle of a git merge that produced conflicts you don't want to resolve right now. Which command cleanly returns you to the pre-merge state?
Options:
  - [CORRECT] git merge --abort
    Comment: Only works while conflicts are unresolved and MERGE_HEAD exists.
  - git reset --hard HEAD~1
  - git checkout .
  - git merge --undo
Hint: Think about what flag pairs with a Git operation specifically to cancel it mid-flight.
```

**24. Trivia, Level 1 — git rebase --abort**
```
Q: Halfway through resolving conflicts in an interactive rebase, you decide the whole rebase was a bad idea. What puts your branch back exactly where it was before you ran git rebase?
Options:
  - [CORRECT] git rebase --abort
    Comment: Resets HEAD and the branch back to the original commit recorded before the rebase started (ORIG_HEAD) — the rebase equivalent of merge --abort.
  - git rebase --skip
  - git checkout --theirs .
  - git stash then git rebase --continue
Hint: There's an --abort flag mirroring merge's, purpose-built for exactly this.
```

**25. Trivia, Level 2 — recovering a dropped stash**
```
Q: You ran git stash drop on your only stash, then remembered you needed those changes. Is the data actually gone, and how would you try to get it back?
Options:
  - [CORRECT] No — a stash is a commit object; if it hasn't been garbage-collected yet, git fsck --unreachable can find it so you can apply it by hash
    Comment: git stash drop just removes the ref, not the underlying commit — until gc runs, fsck --unreachable can surface it.
  - No — it's recoverable with git stash pop --force
  - Yes — dropped stashes are deleted immediately and cannot be recovered
  - No — run git stash recover <name>, a built-in command for this exact case
Hint: A stash is just a commit under the hood — dropping it only removes the pointer.
```

**26. Trivia, Level 2 — "pre-commit" the hook vs. pre-commit the framework**
```
Q: Your team's README says "we use pre-commit" for hook management. A new hire assumes this means they wrote a raw .git/hooks/pre-commit shell script. Why might that assumption be wrong?
Options:
  - [CORRECT] "pre-commit" is also the name of a popular framework (pre-commit.com) that manages several hooks via a .pre-commit-config.yaml file
    Comment: The pre-commit framework is distinct from the Git hook of the same name — it can install itself into multiple hook slots from one shared, version-controlled config.
  - Git hooks were renamed in a recent Git release, so "pre-commit" no longer refers to a hook
  - Only Husky can manage the pre-commit hook; any other tool claiming to is unofficial
  - "pre-commit" in a README always refers to a CI pipeline step, never a local Git hook
Hint: Two very different things share this exact name.
```

**27. Trivia, Level 2 — squash merge vs merge commit trade-off**
```
Q: A pull request can be integrated as a merge commit, a squash merge, or a rebase-and-merge. What's the practical trade-off between squash merging and a regular merge commit?
Options:
  - [CORRECT] Squash merging collapses every commit into one, trading individual commit granularity for a clean single-entry history; a merge commit preserves every original commit plus branch structure
    Comment: Squash is popular for noisy WIP-commit branches; teams writing careful atomic commits often prefer a real merge instead.
  - Squash merging is only available for PRs with a single commit
  - A merge commit deletes the feature branch's commit history after merging, while squash keeps it
  - There's no actual difference in the resulting main branch
Hint: One keeps every commit; one keeps exactly one.
```

## Suggested Next Steps

1. **Resolve the live production bug first** (topic 363) — this is the only item here with real-time user impact, independent of the rest of this audit.
2. **Decide the 3 topic-consolidation calls**: merge 214 into 17, merge 218 into 27, rename 365. These affect how the comment-backfill and gap-filling work below should be scoped (no point fixing comments on content about to be retired).
3. **Prioritize writing content for topic 364** (remote-collaboration) — it already has a lesson with zero quiz support.
4. **Fix the 5 hard correctness bugs** (Q698, Q808, Q770, Q3293, Q865) plus the lower-severity ones (Q694, Q695, Q823, Q845, Q866, Q879).
5. **Backfill comments on the correct option** — the dominant, highest-leverage fix, affecting 93% of all Trivia questions.
6. **Reformat all 10 General answers to real HTML.**
7. **Fix the revealing hints** concentrated in the oldest ID ranges (roughly 663–886).
8. **Resolve the ~20 duplicate clusters** found within and across topics (see per-cluster detail) — mostly resolvable by keeping the better-commented version of each pair.
9. **Review the 27 drafted questions** above and mark each approved/needs-edit/reject.
10. Only after 1-9: seed approved content with `status='Pending'` (per the agreed workflow for this subject), then promote to `'Active'` only after a final review pass confirms quality — mirroring the two-step process already used for the JavaScript Trivia backlog.
