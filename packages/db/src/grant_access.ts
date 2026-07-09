import postgres from 'postgres';

const remoteUrl = 'postgres://stingray:Stingr@y4396@stingray-qnap:5432/paperclip_wsl';
const userId = 'GOLumJY2EqVe7ypjD08B9mxP81dvoa4v';
const companyId = 'bf21afba-af57-4c47-8e4e-3f7f1904908c';

async function main() {
    const sql = postgres(remoteUrl);
    try {
        console.log('Granting instance_admin role...');
        await sql`
      INSERT INTO instance_user_roles (id, user_id, role, created_at, updated_at)
      VALUES (gen_random_uuid(), ${userId}, 'instance_admin', NOW(), NOW())
      ON CONFLICT (user_id, role) DO NOTHING
    `;

        console.log('Adding company membership...');
        await sql`
      INSERT INTO company_memberships (id, company_id, principal_type, principal_id, status, membership_role, created_at, updated_at)
      VALUES (gen_random_uuid(), ${companyId}, 'user', ${userId}, 'active', 'admin', NOW(), NOW())
      ON CONFLICT (company_id, principal_type, principal_id) DO NOTHING
    `;

        console.log('Access granted successfully.');
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await sql.end();
    }
}

main();
