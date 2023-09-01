import { rootLogger } from '../../util/logger';
import { allChainIds } from '../chain';
import { db_query, typeExists } from './utils';

const logger = rootLogger.child({ module: 'db', component: 'migrate' });

export async function db_migrate() {
    logger.info({ msg: 'Migrate begin' });

    // ============
    // custom types
    // ============

    /**
     * evm_address: 
     *  It's a bit more difficult to use but half the size using bytea instead of string
     *  also, there is no case weirdness with bytea
     * 
    beefy=# select 
        octet_length('\x2BdfBd329984Cf0DC9027734681A16f542cF3bB4'::bytea) as bytea_addr_size, 
        octet_length('0x2BdfBd329984Cf0DC9027734681A16f542cF3bB4') as str_addr_size,
        (select typlen from pg_type where oid = 'bigint'::regtype::oid) as bigint_addr_size,
        (select typlen from pg_type where oid = 'int'::regtype::oid) as int_addr_size
        ;
        
    bytea_addr_size | str_addr_size | bigint_addr_size | int_addr_size 
    -----------------+---------------+------------------+---------------
                20 |            42 |                8 |             4

    (1 row)
    */

    if (!(await typeExists('chain_enum'))) {
        await db_query(`
          CREATE TYPE chain_enum AS ENUM ('ethereum');
      `);
    }
    for (const chain of allChainIds) {
        await db_query(`ALTER TYPE chain_enum ADD VALUE IF NOT EXISTS %L`, [chain]);
    }

    if (!(await typeExists('evm_address_bytea'))) {
        await db_query(`
        CREATE DOMAIN evm_address_bytea AS BYTEA;
      `);
    }

    if (!(await typeExists('evm_trx_hash'))) {
        await db_query(`
        CREATE DOMAIN evm_trx_hash AS BYTEA;
      `);
    }

    if (!(await typeExists('evm_decimal_256'))) {
        await db_query(`
        CREATE DOMAIN evm_decimal_256 
          -- 24 is the max decimals in current addressbook, might change in the future
          -- 100 is the maximum number of digits stored, not the reserved space
          AS NUMERIC(100, 24)
          CHECK (nullif(VALUE, 'NaN') is not null);
      `);
    }

    if (!(await typeExists('evm_decimal_256_nullable'))) {
        await db_query(`
        CREATE DOMAIN evm_decimal_256_nullable 
          -- 24 is the max decimals in current addressbook, might change in the future
          -- 100 is the maximum number of digits stored, not the reserved space
          AS NUMERIC(100, 24)
          CHECK (VALUE is NULL OR nullif(VALUE, 'NaN') is not null);
      `);
    }

    // ===============
    // helper function
    // ===============

    await db_query(`
        CREATE OR REPLACE FUNCTION bytea_to_hexstr(bytea) RETURNS character varying 
          AS $$
            SELECT '0x' || encode($1::bytea, 'hex')
          $$
          LANGUAGE SQL
          IMMUTABLE
          RETURNS NULL ON NULL INPUT;
  
      CREATE OR REPLACE FUNCTION hexstr_to_bytea(varchar) RETURNS bytea 
        AS $$
          select decode(substring($1 ,3), 'hex')
        $$
        LANGUAGE SQL
        IMMUTABLE
        RETURNS NULL ON NULL INPUT;
  
      -- Adapted from https://stackoverflow.com/a/49688529/2523414
      create or replace function jsonb_merge(CurrentData jsonb,newData jsonb)
        returns jsonb
        language sql
        immutable
        as $jsonb_merge_func$
        select case jsonb_typeof(CurrentData)
          when 'object' then case jsonb_typeof(newData)
            when 'object' then COALESCE((
              select    jsonb_object_agg(k, case
                          when e2.v is null then e1.v
                          when e1.v is null then e2.v
                          when e1.v = e2.v then e1.v 
                          else jsonb_merge(e1.v, e2.v)
                        end)
              from      jsonb_each(CurrentData) e1(k, v)
              full join jsonb_each(newData) e2(k, v) using (k)
            ), '{}'::jsonb)
            else newData
          end
          when 'array' then CurrentData || newData
          else newData
        end
        $jsonb_merge_func$;
    `);

    // have a vaults table so we can format the data in a more readable way
    // this also helps to fill dashboard filters like "eol", "id" by chain, etc
    await db_query(`
      CREATE TABLE IF NOT EXISTS vault (
        id character varying PRIMARY KEY,
        eol boolean NOT NULL,
        chain chain_enum NOT NULL,
        strategy_address evm_address_bytea NOT NULL,
        platform_id character varying NOT NULL,
        tvl_usd double decimal NOT NULL
      );
    `);

    // store all raw reports
    await db_query(`
      CREATE TABLE IF NOT EXISTS raw_report (
        raw_report_id serial PRIMARY KEY,
        chain chain_enum NOT NULL,
        datetime timestamp with time zone NOT NULL,
        report_content jsonb NOT NULL
      );
    `);

    logger.info({ msg: 'Migrate done' });
}
