-- This is an empty migration.

-- we have previously added the streamer for the `rebel_guy` registered user, but this didn't come with any of the side effects (e.g. ranks).
-- we remove it here to force the streamer to be created properly

SET foreign_key_checks = 0;
TRUNCATE TABLE streamer;
SET foreign_key_checks = 1;
