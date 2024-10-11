const { test } = require('ava');
const { PGlite } = require('@electric-sql/pglite');

test('concurrent queries', async (t) => {
  const db = await PGlite.create();

  await db.query('CREATE TABLE test (id SERIAL PRIMARY KEY, value TEXT)');
  await db.query("INSERT INTO test (value) VALUES ('a'), ('b'), ('c')");

  const queries = [
    db.query('SELECT * FROM test WHERE id = 1'),
    db.query('SELECT * FROM test WHERE id = 2'),
    db.query('SELECT * FROM test WHERE id = 3'),
  ];

  const results = await Promise.all(queries);

  t.is(results.length, 3);
  t.is(results[0].rows[0].value, 'a');
  t.is(results[1].rows[0].value, 'b');
  t.is(results[2].rows[0].value, 'c');

  await db.close();
});
