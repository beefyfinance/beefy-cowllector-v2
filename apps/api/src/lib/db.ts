import { Pool } from 'pg';

// Define database types
export type DB = Pool;

// Parse database URL for Heroku or use local config
const getDatabaseConfig = () => {
    const connectionString = process.env.DATABASE_URL;
    if (connectionString) {
        return {
            connectionString,
            ssl: {
                rejectUnauthorized: false, // Required for Heroku
            },
        };
    }
    const { POSTGRES_USER, POSTGRES_HOST, POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_PORT } = process.env;

    if (!POSTGRES_USER || !POSTGRES_HOST || !POSTGRES_DB || !POSTGRES_PASSWORD || !POSTGRES_PORT) {
        throw new Error('Missing required database configuration');
    }

    return {
        user: POSTGRES_USER,
        host: POSTGRES_HOST,
        database: POSTGRES_DB,
        password: POSTGRES_PASSWORD,
        port: Number.parseInt(POSTGRES_PORT, 10),
        ssl: {
            rejectUnauthorized: false, // Required for Heroku
        },
    };
};

// Create and export the database pool
export const db = new Pool(getDatabaseConfig());

// Handle shutdown gracefully
process.on('SIGTERM', async () => {
    console.log('Shutting down database connection...');
    await db.end();
});
