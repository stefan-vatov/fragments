## [1.6.1](https://github.com/stefan-vatov/fragments/compare/1.6.0...1.6.1) (2026-11-15)

### Bug Fixes

- preserve drafts and app windows through UI transitions ([4126daa](https://github.com/stefan-vatov/fragments/commit/4126daaf7bd938691d32fde7a5776868f395c849))

# [1.6.0](https://github.com/stefan-vatov/fragments/compare/1.5.7...1.6.0) (2026-11-15)

### Bug Fixes

- add an error boundary with a retry to the view ([b6d9dcd](https://github.com/stefan-vatov/fragments/commit/b6d9dcd040a16a08ed165a71a6c7788bea3029d8))
- adopt view state applied to an open leaf ([afbe539](https://github.com/stefan-vatov/fragments/commit/afbe539c4ab068189875a0ec4ce264f92ec39ef2))
- bound body index retries ([0aac642](https://github.com/stefan-vatov/fragments/commit/0aac642589c84a66f4db23562b8017bc772dd82d))
- cache the collection list per library revision ([4504c25](https://github.com/stefan-vatov/fragments/commit/4504c25681a2075fa0f9e5e354ca78bbee0b51e5))
- cancel a title edit on escape ([b85c0fd](https://github.com/stefan-vatov/fragments/commit/b85c0fdee68416e36f2cfd9fce4d817205ed11fb))
- check the reserved scratchpad path after de-duplication ([6b6529f](https://github.com/stefan-vatov/fragments/commit/6b6529f7bbde691473a9c8351f69202731c39f5a))
- close the global search results when focus leaves ([e138837](https://github.com/stefan-vatov/fragments/commit/e138837c83eb24aabb6568f8984b91fce0c1465c))
- commit tag edits to the fragment they were typed for ([8a9943c](https://github.com/stefan-vatov/fragments/commit/8a9943c7cd0ecfcb6729d779fbbf513eed171f10))
- compute the palette results only while it is open ([72ae798](https://github.com/stefan-vatov/fragments/commit/72ae798027c7d06e8d305fe1e0e6e308cd587186))
- debounce syntax highlighting while typing ([31cf131](https://github.com/stefan-vatov/fragments/commit/31cf131a1f07b64b57e829db20bb5fd05d2d95cb))
- deduplicate fragment tags ([e52c729](https://github.com/stefan-vatov/fragments/commit/e52c729099d42a0b8029b02cef9bcd4f39aef774))
- disable copy until the fragment body has loaded ([2232f3b](https://github.com/stefan-vatov/fragments/commit/2232f3b8b85d77994147e64bf959536b3d5bf769))
- drop satisfied star intents so external changes apply ([c817782](https://github.com/stefan-vatov/fragments/commit/c817782901c5517191fda61f2b97a52af62a8c39))
- expose full collection names in a tooltip ([31f243e](https://github.com/stefan-vatov/fragments/commit/31f243ef156b0d81082b71fc67c944bbb6d983b5))
- expose selection state to assistive technology ([852b39d](https://github.com/stefan-vatov/fragments/commit/852b39d5fe0031de25d471c2c33e993f13439fdb))
- expose the fragment's file path in the header ([eecbf5e](https://github.com/stefan-vatov/fragments/commit/eecbf5e5675fea23c77585fd5bc4f7bb5b9c1a5a))
- fall back to plain text in forced-colors mode ([f319453](https://github.com/stefan-vatov/fragments/commit/f319453bd2b3fd78e731b0b107a21f97bf7305e8))
- fall back to the file name for blank frontmatter titles ([f5cc944](https://github.com/stefan-vatov/fragments/commit/f5cc9446b0af4329304f167a964c06be7de4605a))
- flush drafts before detaching the view on unload ([f6ed8b9](https://github.com/stefan-vatov/fragments/commit/f6ed8b9514cf124d233e303b732fd295bbf9e566))
- follow moved files when a folder is renamed externally ([0109338](https://github.com/stefan-vatov/fragments/commit/010933841668e285d7168dd19432d7aaaeb1c966))
- follow the moved file when its title write fails ([2aa5b8b](https://github.com/stefan-vatov/fragments/commit/2aa5b8be876adad67d716399f4e1ac432c7886fd))
- give list rows a machine-readable timestamp ([8b491c8](https://github.com/stefan-vatov/fragments/commit/8b491c8a1567c988bc2d161fe1bffa4471a589aa))
- give the command palette input an accessible name ([dcabec8](https://github.com/stefan-vatov/fragments/commit/dcabec8132c3f88dfc609341442e7f53f4e47047))
- give the icon-only buttons accessible names ([9e6e802](https://github.com/stefan-vatov/fragments/commit/9e6e802a98181cc8e86eb037bd55771699eb16e3))
- give touch controls 44px targets ([71f102c](https://github.com/stefan-vatov/fragments/commit/71f102c61d4b981b4bc833e0ef42d2bed89e8fad))
- guard the new-collection dialog against double submit ([b299ee2](https://github.com/stefan-vatov/fragments/commit/b299ee2b161ff3a321f407fdfad83318e314b98c))
- harden the headless harness against closed targets and wrong popouts ([d99d38f](https://github.com/stefan-vatov/fragments/commit/d99d38f9dcc1e3852be16a048d88b0a2ecdb4904))
- highlight large fragments instead of silently disabling it ([a35fa08](https://github.com/stefan-vatov/fragments/commit/a35fa081dceb98cdb8aa8091dff243ca10a996dd))
- honour common spellings of the starred flag ([d2841c1](https://github.com/stefan-vatov/fragments/commit/d2841c1ffc468d762d4086a402d478e3ed019238))
- ignore a second folder change while one is reloading ([af0724c](https://github.com/stefan-vatov/fragments/commit/af0724c8afe1d4da331bd3f2406efb4fe6c19a7a))
- ignore body reads that started before a path was replaced ([a319462](https://github.com/stefan-vatov/fragments/commit/a31946295ea969b0a55811144f0fe344725e221c))
- ignore enter while an IME composition is active ([c5f11b1](https://github.com/stefan-vatov/fragments/commit/c5f11b17e8463328f568b34adb2e54e8b1572353))
- keep a deleted fragment's draft recoverable ([417cb02](https://github.com/stefan-vatov/fragments/commit/417cb02aa70e3ebfe18be9288a9a46cb0e9a0362))
- keep a failed draft when switching fragments ([4b02e1a](https://github.com/stefan-vatov/fragments/commit/4b02e1acab9df76c6c093e6a448ab1e688e27e4d))
- keep a restored main-window leaf docked ([d6e6e55](https://github.com/stefan-vatov/fragments/commit/d6e6e558469f67a9de9aa75347042205ab8c6466))
- keep an in-progress title edit across external changes ([f240eb3](https://github.com/stefan-vatov/fragments/commit/f240eb3182093849e187fedc3c093eac95d28bb6))
- keep failed drafts attached to their file ([d20cc61](https://github.com/stefan-vatov/fragments/commit/d20cc61ef6b93cd17ca2d8e6da0b0412b3a7ccb9))
- keep focus in the editor after trashing a fragment ([5512275](https://github.com/stefan-vatov/fragments/commit/5512275f171376e37d950e7b0f27a7bc208bc82d))
- keep inputs at 16px to prevent mobile zoom ([b320871](https://github.com/stefan-vatov/fragments/commit/b3208716b080a05ad7517484d8f8b47b2386c9f1))
- keep list filters when picking from a global picker ([03cd7f9](https://github.com/stefan-vatov/fragments/commit/03cd7f9eaec8620bc81956d42c0e99c5f8fc646c))
- keep recency for property-only writes ([262f94d](https://github.com/stefan-vatov/fragments/commit/262f94dc6cf405a523f490817ab5f1a6d87c67ae))
- keep relative times fresh while the view stays open ([64e8f1a](https://github.com/stefan-vatov/fragments/commit/64e8f1a03dd55fc977b5cddeeaaeaf21015381b4))
- keep relocations transitive and pruned ([e998477](https://github.com/stefan-vatov/fragments/commit/e99847793ee81e3cea79a2efff76088fbe6aa4c4))
- keep restored duplicate leaves and collapse only on explicit open ([2d50f67](https://github.com/stefan-vatov/fragments/commit/2d50f670202200229b4315cdf235ad321cdf312f))
- keep the dev build out of the repository root ([9c83d69](https://github.com/stefan-vatov/fragments/commit/9c83d69c9fa279d1ce53f62e773803f073114cfe))
- keep the draft when the open file is renamed outside Fragments ([98c4038](https://github.com/stefan-vatov/fragments/commit/98c4038dac81c7ebfb52ce0c8a035df085630805))
- keep the highlighted result inside the current list ([9e2400a](https://github.com/stefan-vatov/fragments/commit/9e2400ab1cfbe08a8980d779907438773328deea))
- keep the library pointed at a renamed root folder ([7831b88](https://github.com/stefan-vatov/fragments/commit/7831b88d86aed6ece52e616f97d70cf2394a7c6a))
- keep the library usable when the stored folder is not a string ([a186167](https://github.com/stefan-vatov/fragments/commit/a186167114d47d9d843bcfe2586991a401ad85ce))
- keep the scratchpad available with no fragment selected ([e2233f3](https://github.com/stefan-vatov/fragments/commit/e2233f337f553172908804eacc6242eaf13ad9b5))
- keep the scratchpad conflict instead of overwriting the external text ([c9ec607](https://github.com/stefan-vatov/fragments/commit/c9ec607e61f38a066bcabfe8c2cc89e72e07059a))
- keep the scratchpad editable after a read error ([031c6be](https://github.com/stefan-vatov/fragments/commit/031c6bef408994431dfe37e9cb1674c2d2cbbb71))
- keep the selected tag chip visible in the filter row ([72ca166](https://github.com/stefan-vatov/fragments/commit/72ca1669c831fb1182fcbd8ec0a7915a373883d4))
- keep valid tags when one frontmatter tag is malformed ([24af31a](https://github.com/stefan-vatov/fragments/commit/24af31ad7ec8ff26b91b06a1b8e9b6796c2557a9))
- label the fragment list and announce its count ([51268a9](https://github.com/stefan-vatov/fragments/commit/51268a9ffe4105ee0a4f8c1a81840d666db9b769))
- let a conflicted scratchpad reload from the file ([9dc1894](https://github.com/stefan-vatov/fragments/commit/9dc18942071092ec34eb0280966eb5cd0a1f281a))
- let a short leaf shrink instead of clipping ([a7b5e64](https://github.com/stefan-vatov/fragments/commit/a7b5e64c1ad3c7272efdb1f0a5414efb67457584))
- let text controls follow their content direction ([170ee54](https://github.com/stefan-vatov/fragments/commit/170ee54b00c58f86a5d08b76d4079f0d426f3048))
- let the list search be cleared ([123d08a](https://github.com/stefan-vatov/fragments/commit/123d08aac0592e5ad0060ae774d35a10c1800b9f))
- make the global search placeholder match what it searches ([ffbd9bb](https://github.com/stefan-vatov/fragments/commit/ffbd9bbbe6a476e3ac0630f40cfe25e5247dfb20))
- move focus into the visible mobile pane ([4d47f92](https://github.com/stefan-vatov/fragments/commit/4d47f92cdf6356c00b0e4151ed37e0670a6cf226))
- name the global search listbox and keep focus on its input ([0bc5ed7](https://github.com/stefan-vatov/fragments/commit/0bc5ed76013496e02400aa38ac6686f597ccdd9f))
- notice when the scratchpad file is deleted outside Fragments ([c40b12d](https://github.com/stefan-vatov/fragments/commit/c40b12deeb8ae67384847a49fe3c6451f0bb415b))
- open a fresh popout instead of replacing an unrelated tab ([485bd59](https://github.com/stefan-vatov/fragments/commit/485bd59f098ee3dba2f91da9c1b5042b86850eb0))
- open the new-collection dialog empty ([d8edda1](https://github.com/stefan-vatov/fragments/commit/d8edda1133f533103fe16573e1575cf260f29622))
- preserve the frontmatter/body separator when saving ([3d0a6e7](https://github.com/stefan-vatov/fragments/commit/3d0a6e7982cb3c5282f8f0c51032a28b2e3e83a3))
- queue view commands until the shell is installed ([95024b4](https://github.com/stefan-vatov/fragments/commit/95024b4a20674509b7884c73eeda229d5fcb8d6d))
- rank palette results with the search scorer ([baa85d6](https://github.com/stefan-vatov/fragments/commit/baa85d65ff51fca8e4072c06236c86e849144fac))
- refresh collections when folders change outside Fragments ([208fb52](https://github.com/stefan-vatov/fragments/commit/208fb52f7ceedaf3189b5167714847098090405b))
- reject dot segments in collection names ([ba0be80](https://github.com/stefan-vatov/fragments/commit/ba0be80a679a833516c89dcf68e3301e8b0ab16d))
- reject traversal segments in restored scopes and folders ([fc8c530](https://github.com/stefan-vatov/fragments/commit/fc8c53048f3670e823a2726989e61bf7d57ef539))
- reload the library even when the renamed root cannot be saved ([85460aa](https://github.com/stefan-vatov/fragments/commit/85460aa2fdd77a76936b6390f64941c70340fa28))
- remove the non-interactive chevron from the tags heading ([3e206e3](https://github.com/stefan-vatov/fragments/commit/3e206e382c7d903f14da61c404f62767cfba2c73))
- render list previews from markdown text instead of stripping brackets ([1bbad8e](https://github.com/stefan-vatov/fragments/commit/1bbad8ec9e0eb2ce6de11dcdb49367cffd5caa70))
- render the sidebar section labels as headings ([bafa042](https://github.com/stefan-vatov/fragments/commit/bafa042d7e76a8bd2d8c3c38ef9598d865a2fddb))
- report a collection name that collides with a file ([61cb989](https://github.com/stefan-vatov/fragments/commit/61cb989019a36feeecdc0845203116b659a1e242))
- report an unknown language instead of silently reverting ([7d3afed](https://github.com/stefan-vatov/fragments/commit/7d3afed8db0692a81088d287f427fdf65c573a00))
- report the scratchpad as unsaved until it exists ([99a7224](https://github.com/stefan-vatov/fragments/commit/99a7224b7ac3ef3b8c771ca0c64b3c8f1435fc7c))
- restore the view without stealing focus ([de536fa](https://github.com/stefan-vatov/fragments/commit/de536faa8913a20520a5886e4bd91c9808fbd7fd))
- retry a failed autosave with backoff ([09260c3](https://github.com/stefan-vatov/fragments/commit/09260c3a75aa530e2b88c174a2e68d2ca1f31835))
- retry a failed body index instead of leaving it empty ([830c1c6](https://github.com/stefan-vatov/fragments/commit/830c1c63a5675c16d7aec87f16d0a5179d213224))
- return the fragment list to the top when the filter changes ([e2aeae8](https://github.com/stefan-vatov/fragments/commit/e2aeae8cf6008b43f590dc2c176d3fcf6cdbbbd2))
- run typescript-only test files ([20314bb](https://github.com/stefan-vatov/fragments/commit/20314bb22b3f1ea75c24611447523f108eae88c5))
- sanitise renamed and moved file names across platforms ([32fd263](https://github.com/stefan-vatov/fragments/commit/32fd2632e70563371b6978822a5b7b98c8cc4f65))
- separate filtered emptiness from an empty library ([96906eb](https://github.com/stefan-vatov/fragments/commit/96906ebdb3bfc0702d8235b947b0d432d8a9c69e))
- settle queued view actions when a command rejects ([3cf32ba](https://github.com/stefan-vatov/fragments/commit/3cf32ba9f5a3302fa0c4315b72e45bb9c61db902))
- settle queued view actions when the plugin unloads ([47a6478](https://github.com/stefan-vatov/fragments/commit/47a64782fa0ac86e6c494145a86ae0eead41f7b0))
- show a retry when a fragment body cannot be read ([b191eff](https://github.com/stefan-vatov/fragments/commit/b191eff4bb99bd51503b2f94f7c391ccbcd10fc7))
- show an error when a markdown preview fails to render ([c536d4e](https://github.com/stefan-vatov/fragments/commit/c536d4ed9284227aa11f024f6eb115d18742e403))
- show counts consistently in the navigation and filter chips ([3abb90f](https://github.com/stefan-vatov/fragments/commit/3abb90fb941a947ac4d1bc51930493123e93d30d))
- show indexing state instead of no content while bodies load ([4f29afb](https://github.com/stefan-vatov/fragments/commit/4f29afb61d245fe59e1ed10e564e2d908f4c103e))
- show the library folder and flag a missing one ([61f4ab7](https://github.com/stefan-vatov/fragments/commit/61f4ab77876e16065ded1fd87dc054d1c3bcd62b))
- size the pane layout from the leaf width ([b27aebf](https://github.com/stefan-vatov/fragments/commit/b27aebfbe78c4ae2b3fe0bc6a446ac7cb1b922e5))
- skip re-reading unchanged bodies on load ([3a948cd](https://github.com/stefan-vatov/fragments/commit/3a948cd49c66264217a4e410f9a52805a9fd5290))
- skip the draft re-read after our own writes ([706918d](https://github.com/stefan-vatov/fragments/commit/706918d200cea28fd28c374c05eb9fe0887c6867))
- skip the library reload when the folder is unchanged ([aaa0817](https://github.com/stefan-vatov/fragments/commit/aaa0817729dcd889c34dec5ec45972d2a07950dc))
- stop body reads when the plugin unloads ([533a912](https://github.com/stefan-vatov/fragments/commit/533a9120d48de21204f19954a4f868ed5f684d07))
- stop marking the editor busy while it loads ([0f19fa7](https://github.com/stefan-vatov/fragments/commit/0f19fa77097e9cb1917ba4bf3fd034d89a94e396))
- stop mobile keyboards from mangling tag and collection names ([5504f5a](https://github.com/stefan-vatov/fragments/commit/5504f5a97fc9bb3efafd7e869133fce4b4c4d5fe))
- stop truncating the global search query ([1affb14](https://github.com/stefan-vatov/fragments/commit/1affb14bb22303feb9ea3081bcebd575ae084503))
- strip a trailing .md suffix from renamed titles ([2621a7e](https://github.com/stefan-vatov/fragments/commit/2621a7eabb775a48e469775c376351258d1b0591))
- toggle the star against the latest intent so a double click reverts ([52990ca](https://github.com/stefan-vatov/fragments/commit/52990cae5dd34dc446c20a6c6b723ce8e450d90e))
- treat the scratchpad path case-insensitively ([fdcae82](https://github.com/stefan-vatov/fragments/commit/fdcae82b6206dae06847caf6a08681b47910e2a7))
- unload the markdown preview components ([06e27a0](https://github.com/stefan-vatov/fragments/commit/06e27a0c07904a86267fce6a3362057e83c1c5d0))
- use the view's own window for clipboard and confirmation ([35ec3ec](https://github.com/stefan-vatov/fragments/commit/35ec3ec537594f4122c668a18da9e56a7406b0fe))
- wait for a queued scratchpad save before reading ([add2bc3](https://github.com/stefan-vatov/fragments/commit/add2bc31daca7c538d691e4910544232e996cefd))

### Features

- add keyboard navigation to the fragment list ([3aee34d](https://github.com/stefan-vatov/fragments/commit/3aee34da69449b1e339e2a095d0a9f13caa3a0ed))
- persist the view state with the leaf ([6cc411f](https://github.com/stefan-vatov/fragments/commit/6cc411fd6473833aef27334626e7def897f2e1b1))

### Performance Improvements

- count footer words in a memoized scan ([0308142](https://github.com/stefan-vatov/fragments/commit/0308142f9e08d81c41bf32cfd364904394fb0075))
- emit once after the body index ([324ddcd](https://github.com/stefan-vatov/fragments/commit/324ddcda4d1085ce4cba49eed617574c95aa6934))

## [1.5.7](https://github.com/stefan-vatov/fragments/compare/1.5.6...1.5.7) (2026-11-02)

### Bug Fixes

- isolate drafts and finish saves before fragment renames ([007f4c0](https://github.com/stefan-vatov/fragments/commit/007f4c0415508324e2b8773f2b115cdeba889ba8))

## [1.5.6](https://github.com/stefan-vatov/fragments/compare/1.5.5...1.5.6) (2026-11-02)

### Bug Fixes

- block stale title edits while creating fragments ([ef31702](https://github.com/stefan-vatov/fragments/commit/ef31702c094b0ca4bdd8ed4f2aacbfc8ae3a8358))

## [1.5.5](https://github.com/stefan-vatov/fragments/compare/1.5.4...1.5.5) (2026-10-27)

### Bug Fixes

- add suffixes for duplicate fragment names ([eeccb73](https://github.com/stefan-vatov/fragments/commit/eeccb7329d8aed8a6be587451f3c2eac3db79ec3))

## [1.5.4](https://github.com/stefan-vatov/fragments/compare/1.5.3...1.5.4) (2026-10-27)

### Bug Fixes

- keep fragment renames on the intended note ([c4da61d](https://github.com/stefan-vatov/fragments/commit/c4da61d5d41332c4e4d0e41e9e8541d0880f2a36))

## [1.5.3](https://github.com/stefan-vatov/fragments/compare/1.5.2...1.5.3) (2026-10-27)

### Bug Fixes

- preserve fragment selection and dialog focus ([24209b1](https://github.com/stefan-vatov/fragments/commit/24209b11265a88c46761596682d3ee15667ae63c))

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
