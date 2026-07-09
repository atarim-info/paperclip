import postgres from 'postgres';

const remoteUrl = 'postgres://stingray:Stingr@y4396@stingray-qnap:5432/paperclip_wsl';

async function main() {
    const sql = postgres(remoteUrl);
    try {
        console.log('\nChecking tables and row counts in remote "paperclip_wsl" database...');
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
