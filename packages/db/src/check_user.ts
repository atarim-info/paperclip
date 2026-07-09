import postgres from 'postgres';

const remoteUrl = 'postgres://stingray:Stingr@y4396@stingray-qnap:5432/paperclip_wsl';

async function main() {
    const sql = postgres(remoteUrl);
    try {
        const users = await sql`SELECT * FROM "user" WHERE email = 'vladimir@atarim.info'`;
        console.log('User:', JSON.stringify(users[0], null, 2));

        if (users[0]) {
            const roles = await sql`SELECT * FROM instance_user_roles WHERE user_id = ${users[0].id}`;
            console.log('Roles:', JSON.stringify(roles, null, 2));

            const memberships = await sql`SELECT * FROM company_memberships WHERE user_id = ${users[0].id}`;
            console.log('Memberships:', JSON.stringify(memberships, null, 2));

            const companies = await sql`SELECT * FROM companies`;
            console.log('All Companies:', JSON.stringify(companies, null, 2));
        } else {
            console.log('User not found.');
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await sql.end();
    }
}

main();
