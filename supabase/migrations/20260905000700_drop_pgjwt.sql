-- pgjwt is unsupported on newer Supabase Postgres images and blocked the version upgrade.
-- Nothing in this database references its functions (sign/verify/url_encode/url_decode/
-- algorithm_sign/try_cast_double): no function body, view or cron job uses them.
drop extension if exists pgjwt;
