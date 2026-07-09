import postgres from 'postgres';

const remoteUrl = 'postgres://stingray:Stingr@y4396@stingray-qnap:5432/paperclip_wsl';
const userId = 'GOLumJY2EqVe7ypjD08B9mxP81dvoa4v';

async function main() {
    const sql = postgres(remoteUrl);
    try {
        const roles = await sql`SELECT * FROM instance_user_roles WHERE user_id = ${userId}`;
        console.log('Roles:', JSON.stringify(roles, null, 2));

        const memberships = await sql`
      SELECT * FROM company_memberships 
      WHERE principal_id = ${userId} AND principal_type = 'user'
    `;
        console.log('Memberships:', JSON.stringify(memberships, null, 2));

        const companies = await sql`SELECT * FROM companies`;
        console.log('Companies:', JSON.stringify(companies, null, 2));

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await sql.end();
    }
}

main();
