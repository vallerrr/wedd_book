-- Wedd Book — seed data.
-- Safe to re-run. Bingo questions and content blocks upsert on their natural
-- keys; programme items are replaced wholesale (see the note above them).

-- ---------------------------------------------------------------------------
-- The 16 icebreaker prompts. Same for everyone; each guest answers privately
-- and all the answers are shown together on review night (27 Sep afternoon).
-- ---------------------------------------------------------------------------
insert into bingo_questions (position, prompt_en, prompt_zh) values
  (1,  'Who has a cat that wakes its owner for a late dinner', '谁有一只小猫晚上要叫醒主人陪吃'),
  (2,  'Who is developing their own game',                     '谁在开发自己的游戏'),
  (3,  'Who has the most colourful outfit',                    '谁的穿搭颜色最多'),
  (4,  'Who laughs the most',                                  '谁笑得最多'),
  (5,  'Who exercised with Chinese uncles in a park',          '谁和中国大爷在公园一起锻炼过'),
  (6,  'Who has two PhD degrees',                              '谁有两个博士学位'),
  (7,  'Who goes to concerts the most',                        '谁去音乐会最多'),
  (8,  'Who is terribly afraid of bees',                       '谁超级害怕蜜蜂'),
  (9,  'Who is the best planner',                              '谁是最好的计划者'),
  (10, 'Who is an enthusiastic skydiver',                      '谁是狂热的跳伞爱好者'),
  (11, 'Who speaks the most languages',                        '谁会说最多的语言'),
  (12, 'Who is getting married soon too (congrats!)',          '谁也快要结婚了（恭喜！）'),
  (13, 'Who has been in a relationship the longest',           '谁谈恋爱的时间最长'),
  (14, 'Who can do latte art',                                 '谁会拉花'),
  (15, 'Who gets up latest in the morning',                    '谁早上起得最晚'),
  (16, 'Whose feet overlap when they sit and think',           '谁思考时（坐着的时候）双脚会重叠')
on conflict (position) do update
  set prompt_en = excluded.prompt_en,
      prompt_zh = excluded.prompt_zh;

-- ---------------------------------------------------------------------------
-- The three days.
-- ---------------------------------------------------------------------------
insert into program_days (day_date, label_en, label_zh, intro_en, intro_zh, position) values
  ('2026-09-26', 'Day 1 · Guiyang', '第一天 · 贵阳',
   'Monkeys, batik, and sour soup fish.', '爬山看猴子、蜡染、酸汤鱼。', 1),
  ('2026-09-27', 'Day 2 · Qianxi', '第二天 · 黔西',
   'The biggest karst cave in China, then photos together and the food street.',
   '中国洞王、一起看照片、逛小吃街。', 2),
  ('2026-09-28', 'Day 3 · The banquet', '第三天 · 婚宴',
   'Tea ceremony in the morning, banquet in the evening.',
   '上午敬茶，晚上婚宴。', 3)
on conflict (day_date) do update
  set label_en = excluded.label_en,
      label_zh = excluded.label_zh,
      intro_en = excluded.intro_en,
      intro_zh = excluded.intro_zh,
      position = excluded.position;

-- ---------------------------------------------------------------------------
-- Free-form prose around the itinerary.
-- ---------------------------------------------------------------------------
insert into content_blocks (key, title_en, title_zh, body_en, body_zh, position) values
  ('trip_intro', 'Welcome', '欢迎',
   'Thank you for signing up to the trip with us! We decided not to have a ceremony on the banquet day, so instead we want to host a small two-day trip for the friends who travelled all this way to celebrate with us.

Day one we stay in Guiyang, day two we move to Qianxi — the town where the banquet happens on the third day.',
   '谢谢你们决定参加我们的婚礼仪式替代旅行！因为我们决定没有传统婚礼仪式，所以希望以两天短途旅行的形式招待远道而来的朋友们。

第一天（26号）我们会待在贵阳，第二天（27号）在黔西县附近，第三天（28号）午宴和晚宴都在黔西。',
   1),

  ('covered', 'On us', '我们请客',
   '- Hotels
- Lunches and dinners
- The batik crafting class',
   '- 酒店
- 饭饭
- 蜡染课',
   2),

  ('not_covered', 'Not covered', '需要自理的部分',
   'Entry tickets to the sightseeing attractions. Bring your ID card or passport — you will need it to get in.',
   '景区门票。记得带身份证或护照，进景区要用。',
   3),

  ('guiyang_extras', 'Other things to do in Guiyang', '在贵阳还能做什么',
   '**Food.** 肠旺面 changwang noodles, 蛋包洋芋, 恋爱豆腐果, 丝娃娃, 裹卷, 糕粑稀饭, 牛肉粉.

**Coffee.** Guiyang''s speciality coffee is genuinely well known — they roast their own beans and some have won international prizes. Try Captain George, Duide, or JUJU.',
   '**吃的。** 肠旺面、蛋包洋芋、恋爱豆腐果、丝娃娃、裹卷、糕粑稀饭、牛肉粉。

**咖啡。** 贵阳的特色咖啡非常出名，豆子是本地烘焙的，有些还在国际上获过奖。推荐 Captain George、Duide、JUJU。',
   4),

  ('qianxi_extras', 'Qianxi', '黔西',
   '**Zhijin Cave** 织金洞 — the karst cave from day two. The canyon next door is worth the extra walk, and the ten-minute boat is about ¥20.

**Wujiang river** 乌江 — boat trips, if the weather is kind.

**Dafuba** 大府坝 — the night food street. Barbecue, sweet rice dumplings, rice noodles, skewers. Crowded and very good.',
   '**织金洞** —— 第二天去的那个溶洞。旁边的大峡谷也值得多走一段，坐船十分钟大概20块。

**乌江** —— 天气好的话可以坐船游江。

**大府坝** —— 夜市小吃街。烧烤、汤圆、米粉、串串，很挤但真的好吃。',
   6),

  ('arrive_early', 'Arriving early or staying on?', '早到或者想多待几天？',
   'We will be doing some day trips around the province. You are very welcome to join — just let us know in advance so we can plan it together.',
   '我们会在省内做一些一日或两日游，非常欢迎你加入！提前告诉我们就好，可以一起商量。',
   5)
on conflict (key) do update
  set title_en = excluded.title_en,
      title_zh = excluded.title_zh,
      body_en  = excluded.body_en,
      body_zh  = excluded.body_zh,
      position = excluded.position;

-- ---------------------------------------------------------------------------
-- Programme items.
--
-- program_items has no natural key, so this replaces the whole set rather than
-- upserting. That is fine while the seed is the source of truth — but once the
-- admin programme editor exists, re-running this would discard edits made
-- there. Add a slug column and switch to an upsert before that happens.
-- ---------------------------------------------------------------------------
delete from program_items;

insert into program_items
  (day_id, position, category, time_label_en, time_label_zh, title_en, title_zh,
   body_en, body_zh, location_name, address, map_url, image_paths)
select d.id, v.position, v.category, v.time_label_en, v.time_label_zh,
       v.title_en, v.title_zh, v.body_en, v.body_zh,
       v.location_name, v.address, v.map_url, v.image_paths::text[]
  from (values

  -- ---- Day 1, Guiyang -----------------------------------------------------
  ('2026-09-26', 1, 'activity', '10:00', '上午十点',
   'Qianling Park', '黔灵山公园',
   'A walk up to the temple, and the wild monkeys along the way.

Lunch after: 肠旺面, the Guiyang noodle everyone should try once. Then coffee — the local roasters are genuinely good.',
   '爬山去看寺庙，路上会遇到野生猴子。

下山后吃肠旺面，贵阳必吃的面。然后去喝咖啡，本地烘焙真的很不错。',
   '黔灵山公园（南门）', '贵阳市枣山路187号（黔灵山公园地铁站 C 口步行 220 米）',
   'https://surl.amap.com/4oQxuPI14c5q', '{}'),

  ('2026-09-26', 2, 'activity', '14:30 — last entry 15:00', '下午2点半（最晚3点入场）',
   'Batik workshop', '蜡染体验',
   'Batik is a traditional Miao craft — wax-resist dyeing on cloth. No pressure to make great art, just enjoy the process.

Please arrive by 14:30 if you can. 15:00 is the last entry.',
   '蜡染是苗族的传统手工艺，用蜡防染在布上画花。不要有压力哈哈，重在体验！

尽量2点半到，3点是最后入场时间。',
   '六分之一蓝空间 · 蜡染扎染手工DIY（大觉精舍店）',
   '贵州省贵阳市云岩区电台街88号（大觉精舍旁）',
   'https://surl.amap.com/g75SaLcbdGn', '{}'),

  ('2026-09-26', 3, 'meal', '18:00', '晚上6点',
   'Dinner — Laokaili sour soup fish', '晚餐 · 老凯俚酸汤鱼（省府店）',
   'A Guizhou institution, and the sour soup fish is on the city''s intangible cultural heritage list.

We have the private room on the first floor up: 「888 苗族古歌」.',
   '贵州老字号，酸汤鱼是贵阳市非物质文化遗产。

已经订好二楼包房「888 苗族古歌」。',
   '老凯俚酸汤鱼（省府店）', null,
   'https://www.amap.com/search?query=%E8%80%81%E5%87%AF%E4%BF%9A%E9%85%B8%E6%B1%A4%E9%B1%BC%E7%9C%81%E5%BA%9C%E5%BA%97', '{}'),

  ('2026-09-26', 4, 'free', 'After dinner', '饭后',
   'Free evening', '自由活动',
   'You are free! If you like old architecture, Jiaxiu Pavilion is worth the walk — built in 1598 and lovely lit up over the river at night.',
   '自由活动时间！如果你对古建筑感兴趣，推荐去甲秀楼散散步看夜景，建于1598年，晚上灯光打在河上很好看。',
   '甲秀楼', null, 'https://www.amap.com/search?query=甲秀楼', '{}'),

  ('2026-09-26', 5, 'hotel', 'Night', '住宿',
   'Atour Light Hotel, Guiyang', '亚朵轻居酒店（贵阳喷水池地铁站）',
   'Booked for the first night.', '第一晚的酒店已经订好了。',
   '贵阳云岩喷水池地铁站亚朵轻居酒店', '贵阳市云岩区黔灵西路11号',
   'https://www.amap.com/search?query=%E4%BA%9A%E6%9C%B5%E8%BD%BB%E5%B1%85%E9%85%92%E5%BA%97%E8%B4%B5%E9%98%B3%E5%96%B7%E6%B0%B4%E6%B1%A0', '{}'),

  -- ---- Day 2, Qianxi ------------------------------------------------------
  ('2026-09-27', 1, 'activity', 'Morning', '上午',
   'Zhijin Cave', '织金洞',
   'The most spectacular karst cave in China — 6.6 km of it, so it is a long walk, but the scale and the lighting are worth it. Karst is *the* landscape of Guizhou, so don''t miss this one.

Next to the cave there is also Zhijin Canyon, and for about ¥20 you can take a ten-minute boat ride.

We may only take you as far as the entrance — we need to head back and prepare.',
   '中国的“洞王”，喀斯特地貌形成的钟乳石洞。总共6.6公里，真的要走很久，但因为它巨大、灯光也做得好，非常值得逛。喀斯特是贵州的代表性地貌，推荐！

旁边还有织金大峡谷，也需要走路，但很漂亮，还可以花20块钱坐10分钟的船。

我和 Yquem 可能只送大家到门口，因为还要回去准备婚礼的事情。',
   '织金洞', null, 'https://www.amap.com/search?query=织金洞', '{}'),

  ('2026-09-27', 2, 'meal', 'Lunch', '午饭',
   'Lunch at home, or local snacks', '在家吃，或者去吃小吃',
   'Nothing formal — either something at home or we go out for local snacks.',
   '不用太正式，在家随便吃点，或者出去吃小吃。',
   null, null, null, '{}'),

  ('2026-09-27', 3, 'free', 'Afternoon', '下午',
   'Free time — or come and decorate', '自由活动 · 也欢迎来帮忙布置',
   'Your afternoon is your own. If you would rather be useful, we will be decorating the house and the venue, and would love the company.',
   '下午自由活动。如果你想找点事做，我们会在家里和会场布置，非常欢迎来一起！',
   null, null, null, '{}'),

  ('2026-09-27', 4, 'activity', 'Late afternoon', '傍晚',
   'Photo viewing at our home', '在我们家一起看照片',
   'Everyone''s bingo answers open up, and we go through them together, question by question. This is the one you have been waiting for.',
   '所有人的宾果答案都会公开，我们一题一题一起看。就是这个时候啦！',
   null, null, null, '{}'),

  ('2026-09-27', 5, 'meal', 'Late dinner', '夜宵',
   'Dafuba street food', '大府坝小吃街',
   'The local night food street — barbecue, sweet rice dumplings, rice noodles, skewers. Properly local and always crowded, and the food is wonderful.',
   '当地很有名的小吃一条街 —— 烧烤、汤圆、米粉、串串。很local也很挤，但真的很好吃！',
   '大府坝', null, 'https://www.amap.com/search?query=大府坝', '{}'),

  -- ---- Day 3, the banquet -------------------------------------------------
  ('2026-09-28', 1, 'activity', '11:00', '上午11点',
   'Tea ceremony at our home', '敬茶仪式 · 在我们家',
   'The one ceremony of the whole weekend. Yquem serves tea to Jiani''s parents — the moment he changes how he addresses them.

At our home, not the hotel.',
   '整个周末唯一的仪式。Yquem 给佳妮的爸妈敬茶 —— 也是他改口的时刻。

在我们家，不在酒店。',
   null, null, null, '{}'),

  ('2026-09-28', 2, 'meal', 'Lunch', '午饭',
   'Lunch in the hotel food hall', '酒店宴会厅午餐',
   'In the same hotel you are staying in — just come downstairs.',
   '就在你住的酒店，下楼就到。',
   null, null, null, '{}'),

  ('2026-09-28', 3, 'free', 'Afternoon', '下午',
   'Free time', '自由活动',
   'Rest, wander, or find us.', '休息、逛逛，或者来找我们。',
   null, null, null, '{}'),

  ('2026-09-28', 4, 'meal', '18:00', '晚上6点',
   'The banquet', '晚宴',
   'The formal dinner — second floor, Diamond Hall.',
   '正式晚宴 —— 二楼钻石厅。',
   '黔西豪庭大酒店', '黔西市花都大道1号',
   'https://surl.amap.com/gpmb0cCCaFV', '{/brand/invitation.jpg}'),

  ('2026-09-28', 5, 'free', 'Later', '晚一点',
   'Maybe the food street again', '也许再去一次小吃街',
   'If anyone still has the energy, we may well go back out for late night food.',
   '如果大家还有精力，我们可能会再去吃一次夜宵！',
   null, null, null, '{}'),

  ('2026-09-28', 6, 'hotel', 'Where you are staying', '住宿',
   'Haoting Hotel, Qianxi', '黔西豪庭大酒店',
   'Both the lunch and the banquet are in this hotel.',
   '午餐和晚宴都在这家酒店。',
   '黔西豪庭大酒店', '黔西市花都大道1号',
   'https://surl.amap.com/gpmb0cCCaFV', '{}')

  ) as v(day_date, position, category, time_label_en, time_label_zh,
         title_en, title_zh, body_en, body_zh, location_name, address, map_url, image_paths)
  join program_days d on d.day_date = v.day_date::date;
