## [1.5.2](https://github.com/stefan-vatov/fragments/compare/1.5.1...1.5.2) (2026-10-25)

### Bug Fixes

- **app:** clamp the virtual list window when the list shrinks ([83115c0](https://github.com/stefan-vatov/fragments/commit/83115c0688bb956f79d0af6baee1c4b0434d6b01))
- **app:** clear the active filter when picking from the command palette ([9dbacd0](https://github.com/stefan-vatov/fragments/commit/9dbacd0e30340039c68b2bf184e739148d53dbc9))
- **app:** keep the editor on the open fragment when entries change ([3fc842b](https://github.com/stefan-vatov/fragments/commit/3fc842b07f44357a31a564a6a9c87a6e88f5786a))
- **app:** let the scratchpad recover from a write conflict ([c27d13d](https://github.com/stefan-vatov/fragments/commit/c27d13d93f4628d79f085863f9ffac3c570ad7fd))
- **app:** never let a stale read overwrite a draft typed while it was in flight ([8755767](https://github.com/stefan-vatov/fragments/commit/875576709d1685203db32df7509e03e1847b08d7))
- **app:** render markdown preview off-screen before swapping it in ([db96e91](https://github.com/stefan-vatov/fragments/commit/db96e91f9c13aa5e478fe938e4c125b609f776da))
- **app:** reset draft bookkeeping when the selection is cleared ([3573af8](https://github.com/stefan-vatov/fragments/commit/3573af8a22ad795fb673658dd8fe8867b5c9a49f))
- **app:** restore the title input when a rename is rejected ([a565f7b](https://github.com/stefan-vatov/fragments/commit/a565f7b7f435fd365eb079c9cf528aa78919203e))
- **app:** save the open draft before trashing the fragment ([00e5885](https://github.com/stefan-vatov/fragments/commit/00e5885fa2cf5f4a61afacfa261761e12b992a9d))
- **app:** scope fragments keyboard shortcuts to the fragments view ([b32315e](https://github.com/stefan-vatov/fragments/commit/b32315ea0f0eb6e76c890b4dbf53a9d587f7921e))
- **app:** serialize fragment mutations and guard selection retargeting ([7c1be71](https://github.com/stefan-vatov/fragments/commit/7c1be7188c50de8c1d94466d3d85132bc20b07df))
- **app:** submit the new collection dialog on enter ([9d65c3f](https://github.com/stefan-vatov/fragments/commit/9d65c3f5793a444ff0c36bec66be227673cec0cb))
- **languages:** treat empty language input as no choice ([abdb158](https://github.com/stefan-vatov/fragments/commit/abdb1586883e44b8adb7bdd1496ef5a8ad287bc4))
- **library:** avoid false conflict when a queued write repeats a snapshot ([946f812](https://github.com/stefan-vatov/fragments/commit/946f812137171f8c7ccf1d0458a7ffb3b4984ef6))
- **library:** canonicalise and validate the fragments folder ([8d58e07](https://github.com/stefan-vatov/fragments/commit/8d58e0702140e9a0d161195b152c0e737f8d5228))
- **library:** canonicalise tag case on read and write ([536b656](https://github.com/stefan-vatov/fragments/commit/536b656687f3654b3c53636ca445e34deefd2251))
- **library:** evict whole subtree on folder events ([85df2fd](https://github.com/stefan-vatov/fragments/commit/85df2fd87e004440c0e994d01055b761b233e517))
- **library:** ignore out-of-order body reads when indexing ([136a793](https://github.com/stefan-vatov/fragments/commit/136a79365905f88faa289f2fb8176474dead56e2))
- **library:** keep the index correct when a title write fails after rename ([eb2415a](https://github.com/stefan-vatov/fragments/commit/eb2415afab9afcda2f12c9a90f0f3c4cfbeef404))
- **library:** nest slash-separated collection names instead of flattening them ([fbc9298](https://github.com/stefan-vatov/fragments/commit/fbc9298922b299eac9e7bf62388ef7fbe07e6a3d))
- **library:** propagate original vault errors instead of effect fiber failures ([5074eff](https://github.com/stefan-vatov/fragments/commit/5074efff478ec4bdb1977875a18769912e2a5416))
- **library:** split scalar frontmatter tags on commas only ([94de88d](https://github.com/stefan-vatov/fragments/commit/94de88defd38151e87ab879a53a245971e42d9a0))
- **library:** treat the fragment title, not the sanitised path, as the rename identity ([37608fc](https://github.com/stefan-vatov/fragments/commit/37608fcbd4ca3cf50361c9cd95fbb25b97a95135))
- **settings:** flush open drafts before changing the fragments folder ([c38edc1](https://github.com/stefan-vatov/fragments/commit/c38edc1b4cd89344244e97853606aa2b818ecc6d))

## [1.5.1](https://github.com/stefan-vatov/fragments/compare/1.5.0...1.5.1) (2026-10-24)

### Bug Fixes

- correct list spacing and add headless obsidian testing ([4482f32](https://github.com/stefan-vatov/fragments/commit/4482f32a959484a51ffc09983daf4102538c35ff))

# [1.5.0](https://github.com/stefan-vatov/fragments/compare/1.4.0...1.5.0) (2026-09-24)

### Features

- refine search and fragment controls ([5c45e50](https://github.com/stefan-vatov/fragments/commit/5c45e5064a23145ccff1d493c4b9ac1cb7369dc1))

# [1.4.0](https://github.com/stefan-vatov/fragments/compare/1.3.0...1.4.0) (2026-09-24)

### Features

- add shared fuzzy search across fragments ([77cb89e](https://github.com/stefan-vatov/fragments/commit/77cb89e69fe5f9f6d62d076165c1d39df1a5579b))

# [1.3.0](https://github.com/stefan-vatov/fragments/compare/1.2.0...1.3.0) (2026-09-24)

### Features

- add language picker and syntax highlighting ([2716aff](https://github.com/stefan-vatov/fragments/commit/2716aff892dfff839b406b9475abe6ba41e01e79))

# [1.2.0](https://github.com/stefan-vatov/fragments/compare/1.1.0...1.2.0) (2026-09-24)

### Features

- persist shared scratchpad in vault ([2aa3330](https://github.com/stefan-vatov/fragments/commit/2aa33301447edfae8df8e69d7d1fe5c261158603))

# [1.1.0](https://github.com/stefan-vatov/fragments/compare/1.0.3...1.1.0) (2026-09-24)

### Features

- add temporary shared scratchpad beside fragments ([0f8c117](https://github.com/stefan-vatov/fragments/commit/0f8c117b3ff4f6e2c44423ad3b1430a1fdd6b026))

## [1.0.3](https://github.com/stefan-vatov/fragments/compare/1.0.2...1.0.3) (2026-09-24)

### Bug Fixes

- keep fragment title and draft in sync on rename ([2978b1b](https://github.com/stefan-vatov/fragments/commit/2978b1b575ec8468c7020c859b0de6198e832806))

## [1.0.2](https://github.com/stefan-vatov/fragments/compare/1.0.1...1.0.2) (2026-09-24)

### Bug Fixes

- select snippet fonts from installed families ([c836115](https://github.com/stefan-vatov/fragments/commit/c836115e269ad45d2bfed0a489d050361bf1242e))

## [1.0.1](https://github.com/stefan-vatov/fragments/compare/1.0.0...1.0.1) (2026-09-24)

### Bug Fixes

- use Obsidian settings with folder suggestions ([03e6c59](https://github.com/stefan-vatov/fragments/commit/03e6c592679ee66a0b521b29b2701845ee383dd9))

# 1.0.0 (2026-09-24)

### Features

- add Fragments Obsidian plugin and BRAT releases ([26f5fbf](https://github.com/stefan-vatov/fragments/commit/26f5fbf85e5025a3d8558d631ce29682c8887e6d))
