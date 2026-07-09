import postgres from 'postgres';

const remoteUrl = 'postgres://stingray:Stingr@y4396@stingray-qnap:5432/paperclip_wsl';

async function main() {
    const sql = postgres(remoteUrl);
    try {
        const tables = ['user', 'instance_user_roles', 'company_memberships', 'companies'];
        for (const table of tables) {
            const columns = await sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = ${table}
      `;
            console.log(`Columns for ${table}:`, columns.map(c => c.column_name).join(', '));
        }

        const users = await sql`SELECT * FROM "user" WHERE email = 'vladimir@atarim.info'`;
        console.log('User:', JSON.stringify(users[0], null, 2));

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await sql.end();
    }
}

main();
