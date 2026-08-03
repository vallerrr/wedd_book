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
   'Monkeys, batik, and a night market.', '爬山看猴子、蜡染、逛夜市。', 1),
  ('2026-09-27', 'Day 2 · Qianxi', '第二天 · 黔西',
   'The biggest karst cave in China, then street food.', '中国洞王，晚上吃小吃。', 2),
  ('2026-09-28', 'Day 3 · The banquet', '第三天 · 午晚宴',
   'No ceremony — sleep in, then lunch downstairs.', '没有仪式，睡饱了下楼吃午饭。', 3)
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
   body_en, body_zh, location_name, address, map_url)
select d.id, v.position, v.category, v.time_label_en, v.time_label_zh,
       v.title_en, v.title_zh, v.body_en, v.body_zh,
       v.location_name, v.address, v.map_url
  from (values

  -- ---- Day 1, Guiyang -----------------------------------------------------
  ('2026-09-26', 1, 'activity', 'Around 10am', '早上十点左右',
   'Qianling Park', '爬黔灵山看猴子',
   'A walk up Qianling mountain to look for the wild monkeys — the ones that drink iced tea. We are not kidding.',
   '爬黔灵山，去看野生猴子喝冰红茶。真的不是开玩笑哈哈。',
   '黔灵山公园', null, 'https://uri.amap.com/search?keyword=黔灵山公园&city=贵阳'),

  ('2026-09-26', 2, 'activity', 'Afternoon', '下午',
   'Batik workshop', '蜡染体验',
   'Batik is a traditional Miao craft — wax-resist dyeing on cloth. No pressure to make great art, just enjoy the process.',
   '蜡染是苗族的传统手工艺，用蜡防染在布上画花。不要有压力哈哈，重在体验！',
   null, null, null),

  ('2026-09-26', 3, 'meal', 'Evening', '晚上',
   'Qingyun market', '青云集市',
   'Food stalls and little stands selling local handmade things. This is where we will have dinner.',
   '有吃的喝的，也有当地文创的小摊。我们会在这里吃晚饭。',
   '青云集市', null, 'https://uri.amap.com/search?keyword=青云集市&city=贵阳'),

  ('2026-09-26', 4, 'free', 'Afterwards', '那之后',
   'Free evening', '自由活动',
   'You are free! If you like old architecture, we recommend a walk to Jiaxiu Pavilion — it was built in 1598 and looks lovely lit up over the river at night.

Then rest well. Day two is more physically demanding.',
   '自由活动时间！如果你对古建筑感兴趣，推荐去甲秀楼散散步看夜景，建于1598年，晚上灯光打在河上很好看。

然后好好休息，第二天会比较消耗体力。',
   '甲秀楼', null, 'https://uri.amap.com/search?keyword=甲秀楼&city=贵阳'),

  ('2026-09-26', 5, 'hotel', 'Night', '住宿',
   'Atour Light Hotel, Guiyang', '亚朵轻居酒店（贵阳喷水池地铁站）',
   'Booked for the first night.', '第一晚的酒店已经订好了。',
   '贵阳云岩喷水池地铁站亚朵轻居酒店', '贵阳市云岩区黔灵西路11号',
   'https://uri.amap.com/search?keyword=亚朵轻居酒店 贵阳喷水池&city=贵阳'),

  -- ---- Day 2, Qianxi ------------------------------------------------------
  ('2026-09-27', 1, 'activity', 'Morning to midday', '上午到中午',
   'Zhijin Cave', '织金洞',
   'The most spectacular karst cave in China — 6.6 km of it, so it is a long walk, but the scale and the lighting are worth it. Karst is *the* landscape of Guizhou, so don''t miss this one.

Next to the cave there is also Zhijin Canyon, and for about ¥20 you can take a ten-minute boat ride.

We may only take you as far as the entrance — we need to head back and prepare for the banquet.',
   '中国的“洞王”，喀斯特地貌形成的钟乳石洞。总共6.6公里，真的要走很久，但因为它巨大、灯光也做得好，非常值得逛。喀斯特是贵州的代表性地貌，推荐！

旁边还有织金大峡谷，也需要走路，但很漂亮，还可以花20块钱坐10分钟的船。

我和 Yquem 可能只送大家到门口，因为还要回去准备第二天婚礼的事情。',
   '织金洞', null, 'https://uri.amap.com/search?keyword=织金洞&city=毕节'),

  ('2026-09-27', 2, 'free', 'Afternoon', '下午',
   'Boat trip, or rest', '坐船游乌江，或者休息',
   'If everyone still has energy we can take a boat along the Wujiang river. Otherwise we rest and explore Qianxi a bit — we will see how we feel.',
   '如果大家还有精力，可以去坐船游乌江。或者就在黔西休息、随便逛逛，到时候看状态决定。',
   null, null, null),

  ('2026-09-27', 3, 'meal', 'Evening', '晚上',
   'Dafuba street food', '大府坝小吃街',
   'Another food hunt. Dafuba is the local night street food area — barbecue, sweet rice dumplings, rice noodles, skewers. It is properly local and gets crowded, but the food is wonderful.',
   '晚上带大家去大府坝，当地很有名的小吃一条街 —— 烧烤、汤圆、米粉、串串。很local也很挤，但真的很好吃！',
   '大府坝', null, 'https://uri.amap.com/search?keyword=大府坝&city=黔西'),

  ('2026-09-27', 4, 'hotel', 'Night', '住宿',
   'The banquet hotel, Qianxi', '黔西的宴会酒店',
   'We move hotels tonight — you will stay in the same hotel where the banquet happens tomorrow.',
   '今晚换酒店，你们会入住明天午宴和晚宴的同一家酒店。',
   null, null, null),

  -- ---- Day 3, the banquet -------------------------------------------------
  ('2026-09-28', 1, 'free', 'Morning', '早上',
   'Sleep in', '睡到自然醒',
   'There is no ceremony, so sleep as long as you like. If you are up early and want to try a local breakfast, come with us or ask and we will point you somewhere good.',
   '因为没有仪式，可以睡饱。如果你醒得早想吃早餐，可以一起去，或者问我们要推荐的小馆子。',
   null, null, null),

  ('2026-09-28', 2, 'meal', 'Around 12:00', '中午12点左右',
   'Lunch banquet', '午宴',
   'In the same hotel you are staying in — just come downstairs.',
   '就在你住的酒店里，下楼就到。',
   null, null, null),

  ('2026-09-28', 3, 'free', 'Afternoon', '下午',
   'Free time', '自由活动',
   'Do whatever you like between the two meals.',
   '两顿饭之间自由安排。',
   null, null, null),

  ('2026-09-28', 4, 'meal', 'Evening', '晚上',
   'Dinner', '晚宴',
   'Dinner is provided too — same place.', '晚饭也管，还是同一个地方。',
   null, null, null)

  ) as v(day_date, position, category, time_label_en, time_label_zh,
         title_en, title_zh, body_en, body_zh, location_name, address, map_url)
  join program_days d on d.day_date = v.day_date::date;
