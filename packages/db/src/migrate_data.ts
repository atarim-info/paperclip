import postgres from 'postgres';

const localUrl = 'postgres://paperclip:paperclip@127.0.0.1:54329/paperclip';
const remoteUrl = 'postgres://stingray:Stingr@y4396@stingray-qnap:5432/paperclip_wsl';

async function main() {
    const localSql = postgres(localUrl);
    const remoteSql = postgres(remoteUrl);

    try {
        console.log('Fetching tables from local database...');
        const tables = await localSql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      AND table_name NOT LIKE 'drizzle_%'
    `;

        const tableNames = tables.map(t => t.table_name);
        console.log(`Found ${tableNames.length} tables.`);

        await remoteSql.begin(async (sql) => {
            // Disable triggers
            await sql`SET session_replication_role = 'replica'`;

            console.log('Truncating all remote tables...');
            const truncateQuery = `TRUNCATE TABLE ${tableNames.map(name => `"${name}"`).join(', ')} CASCADE`;
            await sql.unsafe(truncateQuery);

            for (const table_name of tableNames) {
                const rows = await localSql.unsafe(`SELECT * FROM "${table_name}"`);
                if (rows.length > 0) {
                    console.log(`Migrating table: ${table_name} (${rows.length} rows)...`);
                    await sql`INSERT INTO ${sql(table_name)} ${sql(rows)}`;
                } else {
                    console.log(`Skipping empty table: ${table_name}`);
                }
            }

            // Re-enable triggers
            await sql`SET session_replication_role = 'origin'`;
        });

        // Sync sequences
        console.log('Syncing sequences...');
        const sequences = await localSql`
      SELECT sequence_name 
      FROM information_schema.sequences 
      WHERE sequence_schema = 'public'
    `;
        for (const { sequence_name } of sequences) {
            const res = await localSql.unsafe(`SELECT last_value FROM "${sequence_name}"`);
            const last_value = res[0].last_value;
            await remoteSql.unsafe(`SELECT setval('"${sequence_name}"', ${last_value}, true)`);
        }

        console.log('Migration complete!');
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    } finally {
        await localSql.end();
        await remoteSql.end();
    }
}

main();
