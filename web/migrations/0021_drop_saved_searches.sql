-- The saved-search ("Kayıtlı arama") feature was removed; its alerts scanned
-- every saved search on each approved listing. Old "search" notifications stay.
DROP TABLE IF EXISTS saved_searches;
