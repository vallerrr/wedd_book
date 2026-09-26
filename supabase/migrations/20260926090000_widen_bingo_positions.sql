-- The board started life as a 4x4 card, so position was capped at 16. It is
-- rendered as a two-column list rather than a square, so the cap was never a
-- layout constraint — only an accident of the original design. Adding a
-- seventeenth prompt hit it. Widen it to something the app will never reach
-- rather than removing it, so a typo in a seed still fails loudly.
alter table bingo_questions
  drop constraint bingo_questions_position_check;

alter table bingo_questions
  add constraint bingo_questions_position_check check (position between 1 and 64);
