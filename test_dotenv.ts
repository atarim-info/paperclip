import { config } from 'dotenv';
import { existsSync } from 'node:fs';
const path = '/home/vladimir/develop/paperclip/.env';
console.log('File exists:', existsSync(path));
config({ path });
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'EMPTY');
