-- Wedd Book — seed data.
-- Safe to re-run: every insert is idempotent on its natural key.

-- The 16 icebreaker prompts. Same for everyone; each guest answers privately
-- and all the answers are shown together on review night (27 Sep afternoon).
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

-- The three days.
insert into program_days (day_date, label_en, label_zh, position) values
  ('2026-09-26', 'Day 1 — Guiyang', '第一天 · 贵阳', 1),
  ('2026-09-27', 'Day 2 — Qianxi',  '第二天 · 黔西', 2),
  ('2026-09-28', 'Day 3 — Banquet', '第三天 · 午晚宴', 3)
on conflict (day_date) do update
  set label_en = excluded.label_en,
      label_zh = excluded.label_zh,
      position = excluded.position;
