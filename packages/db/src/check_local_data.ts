import postgres from 'postgres';

const localUrl = 'postgres://paperclip:paperclip@127.0.0.1:54329/paperclip';

async function main() {
    const sql = postgres(localUrl);
    try {
        console.log('Checking databases...');
        const dbs = await sql`SELECT datname FROM pg_database WHERE datistemplate = false`;
        console.log('Databases:', dbs.map(d => d.datname).join(', '));

        console.log('\nChecking tables and row counts in "paperclip" database...');
        const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `;

        for (const { table_name } of tables) {
            const [{ count }] = await sql.unsafe(`SELECT count(*) FROM "${table_name}"`);
            if (count > 0) {
                console.log(`${table_name}: ${count} rows`);
            }
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await sql.end();
    }
}

main();
